from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, get_conn, insertar_receta, obtener_receta
from search import buscar_recetas
from normalizer import parsear_input_usuario, normalizar_lista
from recipe_parser import parsear_receta
from recipe_suggester import sugerir_recetas
from models import BusquedaRequest, RecetaCreate, ParseRecetaRequest, SugerirRequest

app = FastAPI(title="LLMC", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {"app": "LLMC", "version": "0.1.0"}


@app.post("/recipes/search")
def search(req: BusquedaRequest):
    resultados = buscar_recetas(
        ingredientes_usuario=req.ingredientes,
        tiempo_max=req.tiempo_max,
        dificultad=req.dificultad,
        tipo=req.tipo,
        incluir_faltantes=req.incluir_faltantes,
        excluir=req.excluir,
        min_match=req.min_match,
    )
    return {"resultados": resultados, "total": len(resultados)}


@app.get("/recipes")
def list_recipes(q: str | None = None, tipo: str | None = None):
    filtros = []
    parametros: list = []
    if q:
        filtros.append("LOWER(r.nombre) LIKE ?")
        parametros.append(f"%{q.lower()}%")
    if tipo:
        filtros.append("r.tipo = ?")
        parametros.append(tipo)
    where = (" WHERE " + " AND ".join(filtros)) if filtros else ""

    with get_conn() as conn:
        filas = conn.execute(
            f"""
            SELECT id, nombre, dificultad, tiempo_minutos, porciones, tipo, origen
            FROM recetas r
            {where}
            ORDER BY nombre
            """,
            parametros,
        ).fetchall()
    return [dict(f) for f in filas]


@app.get("/recipes/{receta_id}")
def get_recipe(receta_id: int):
    with get_conn() as conn:
        receta = obtener_receta(conn, receta_id)
    if not receta:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return receta


def _normalizar_lista_ingredientes(items):
    vistos = set()
    salida = []
    for it in items:
        if isinstance(it, str):
            nombre = it
            cantidad = 0
            unidad = "al gusto"
        else:
            nombre = it.get("nombre", "")
            cantidad = float(it.get("cantidad", 0) or 0)
            unidad = it.get("unidad") or "al gusto"
        nombres_norm = normalizar_lista([nombre])
        if not nombres_norm:
            continue
        nombre_norm = nombres_norm[0]
        if nombre_norm in vistos:
            continue
        vistos.add(nombre_norm)
        salida.append({"nombre": nombre_norm, "cantidad": cantidad, "unidad": unidad})
    return salida


@app.delete("/recipes/{receta_id}")
def delete_recipe(receta_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM recetas WHERE id = ?", (receta_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Receta no encontrada")
        conn.execute("DELETE FROM recetas WHERE id = ?", (receta_id,))
    return {"ok": True, "id": receta_id}


@app.post("/recipes")
def create_recipe(receta: RecetaCreate):
    datos = receta.model_dump()
    datos["ingredientes_esenciales"] = _normalizar_lista_ingredientes(datos["ingredientes_esenciales"])
    datos["ingredientes_opcionales"] = _normalizar_lista_ingredientes(datos["ingredientes_opcionales"])

    with get_conn() as conn:
        existente = conn.execute(
            "SELECT id FROM recetas WHERE LOWER(nombre) = LOWER(?)",
            (datos["nombre"],),
        ).fetchone()
        if existente:
            return obtener_receta(conn, existente["id"])

        receta_id = insertar_receta(conn, datos)
        creada = obtener_receta(conn, receta_id)
    return creada


@app.post("/recipes/parse")
def parse_recipe(req: ParseRecetaRequest):
    try:
        receta = parsear_receta(req.texto, req.api_key, req.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al llamar a Claude: {e}")
    return receta


@app.post("/recipes/suggest")
def suggest_recipes(req: SugerirRequest):
    try:
        recetas = sugerir_recetas(req.ingredientes, req.excluir, req.api_key, req.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al llamar al LLM: {e}")
    return {"recetas": recetas}


@app.get("/ingredients/parse")
def parse_ingredients(texto: str):
    return {"ingredientes": parsear_input_usuario(texto)}


@app.get("/ingredients")
def list_ingredients():
    with get_conn() as conn:
        filas = conn.execute("SELECT nombre FROM ingredientes ORDER BY nombre").fetchall()
    return [f["nombre"] for f in filas]
