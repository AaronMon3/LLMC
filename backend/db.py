import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "data" / "recetas.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS recetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    dificultad TEXT NOT NULL DEFAULT 'facil',
    tiempo_minutos INTEGER NOT NULL,
    porciones INTEGER NOT NULL DEFAULT 2,
    tipo TEXT,
    pasos TEXT NOT NULL,
    origen TEXT NOT NULL DEFAULT 'base',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingredientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    categoria TEXT
);

CREATE TABLE IF NOT EXISTS receta_ingredientes (
    receta_id INTEGER NOT NULL,
    ingrediente_id INTEGER NOT NULL,
    esencial INTEGER NOT NULL DEFAULT 1,
    cantidad REAL NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'al gusto',
    PRIMARY KEY (receta_id, ingrediente_id),
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE,
    FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ri_ingrediente ON receta_ingredientes(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_recetas_tiempo ON recetas(tiempo_minutos);
CREATE INDEX IF NOT EXISTS idx_recetas_dificultad ON recetas(dificultad);
"""


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_or_create_ingrediente(conn, nombre: str, categoria: str | None = None) -> int:
    row = conn.execute("SELECT id FROM ingredientes WHERE nombre = ?", (nombre,)).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        "INSERT INTO ingredientes (nombre, categoria) VALUES (?, ?)",
        (nombre, categoria),
    )
    return cur.lastrowid


def _normalizar_pasos(pasos: list) -> list[dict]:
    resultado = []
    for p in pasos:
        if isinstance(p, str):
            resultado.append({"texto": p, "tiempo_minutos": None})
        elif isinstance(p, dict):
            resultado.append({
                "texto": p.get("texto", ""),
                "tiempo_minutos": p.get("tiempo_minutos"),
            })
        else:
            resultado.append({"texto": str(p), "tiempo_minutos": None})
    return resultado


def _normalizar_ingrediente(ing) -> dict:
    if isinstance(ing, str):
        return {"nombre": ing, "cantidad": 0, "unidad": "al gusto"}
    if isinstance(ing, dict):
        return {
            "nombre": ing["nombre"],
            "cantidad": float(ing.get("cantidad", 0) or 0),
            "unidad": ing.get("unidad") or "al gusto",
        }
    raise ValueError(f"Ingrediente con formato invalido: {ing}")


def insertar_receta(conn, receta: dict) -> int:
    import json

    pasos_norm = _normalizar_pasos(receta["pasos"])

    cur = conn.execute(
        """
        INSERT INTO recetas (nombre, dificultad, tiempo_minutos, porciones, tipo, pasos, origen)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            receta["nombre"],
            receta.get("dificultad", "facil"),
            receta["tiempo_minutos"],
            receta.get("porciones", 2),
            receta.get("tipo"),
            json.dumps(pasos_norm, ensure_ascii=False),
            receta.get("origen", "base"),
        ),
    )
    receta_id = cur.lastrowid

    for raw in receta.get("ingredientes_esenciales", []):
        ing = _normalizar_ingrediente(raw)
        ing_id = get_or_create_ingrediente(conn, ing["nombre"])
        conn.execute(
            "INSERT INTO receta_ingredientes (receta_id, ingrediente_id, esencial, cantidad, unidad) VALUES (?, ?, 1, ?, ?)",
            (receta_id, ing_id, ing["cantidad"], ing["unidad"]),
        )

    for raw in receta.get("ingredientes_opcionales", []):
        ing = _normalizar_ingrediente(raw)
        ing_id = get_or_create_ingrediente(conn, ing["nombre"])
        conn.execute(
            "INSERT INTO receta_ingredientes (receta_id, ingrediente_id, esencial, cantidad, unidad) VALUES (?, ?, 0, ?, ?)",
            (receta_id, ing_id, ing["cantidad"], ing["unidad"]),
        )

    return receta_id


def obtener_receta(conn, receta_id: int) -> dict | None:
    import json

    row = conn.execute("SELECT * FROM recetas WHERE id = ?", (receta_id,)).fetchone()
    if not row:
        return None

    ingredientes = conn.execute(
        """
        SELECT i.nombre, ri.esencial, ri.cantidad, ri.unidad
        FROM receta_ingredientes ri
        JOIN ingredientes i ON i.id = ri.ingrediente_id
        WHERE ri.receta_id = ?
        """,
        (receta_id,),
    ).fetchall()

    return {
        "id": row["id"],
        "nombre": row["nombre"],
        "dificultad": row["dificultad"],
        "tiempo_minutos": row["tiempo_minutos"],
        "porciones": row["porciones"],
        "tipo": row["tipo"],
        "pasos": _normalizar_pasos(json.loads(row["pasos"])),
        "origen": row["origen"],
        "ingredientes_esenciales": [
            {"nombre": r["nombre"], "cantidad": r["cantidad"], "unidad": r["unidad"]}
            for r in ingredientes if r["esencial"]
        ],
        "ingredientes_opcionales": [
            {"nombre": r["nombre"], "cantidad": r["cantidad"], "unidad": r["unidad"]}
            for r in ingredientes if not r["esencial"]
        ],
    }
