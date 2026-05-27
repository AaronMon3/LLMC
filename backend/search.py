import json
from db import get_conn
from normalizer import normalizar_lista

INGREDIENTES_BASE = {
    "sal", "pimienta", "aceite", "agua", "vinagre", "azucar",
}


def buscar_recetas(
    ingredientes_usuario: list[str],
    tiempo_max: int | None = None,
    dificultad: str | None = None,
    tipo: str | None = None,
    incluir_faltantes: bool = True,
    limite: int = 20,
    excluir: list[str] | None = None,
    min_match: float = 0.5,
    modo_aprovechar: bool = False,
) -> list[dict]:
    ingredientes_norm = set(normalizar_lista(ingredientes_usuario))
    if not ingredientes_norm:
        return []

    excluir_norm = set(normalizar_lista(excluir or []))
    ingredientes_efectivos = (ingredientes_norm | INGREDIENTES_BASE) - excluir_norm

    filtros_sql = []
    parametros: list = []
    if tiempo_max is not None:
        filtros_sql.append("r.tiempo_minutos <= ?")
        parametros.append(tiempo_max)
    if dificultad:
        filtros_sql.append("r.dificultad = ?")
        parametros.append(dificultad)
    if tipo:
        filtros_sql.append("r.tipo = ?")
        parametros.append(tipo)

    where_extra = (" AND " + " AND ".join(filtros_sql)) if filtros_sql else ""

    with get_conn() as conn:
        query = f"""
            SELECT r.id, r.nombre, r.dificultad, r.tiempo_minutos,
                   r.porciones, r.tipo, r.pasos, r.origen,
                   i.nombre AS ingrediente_nombre, ri.esencial,
                   ri.cantidad, ri.unidad
            FROM recetas r
            JOIN receta_ingredientes ri ON ri.receta_id = r.id
            JOIN ingredientes i ON i.id = ri.ingrediente_id
            WHERE 1=1{where_extra}
        """
        filas = conn.execute(query, parametros).fetchall()

    agrupado: dict[int, dict] = {}
    for f in filas:
        rid = f["id"]
        if rid not in agrupado:
            pasos_raw = json.loads(f["pasos"])
            pasos = [
                p if isinstance(p, dict) else {"texto": p, "tiempo_minutos": None}
                for p in pasos_raw
            ]
            agrupado[rid] = {
                "id": rid,
                "nombre": f["nombre"],
                "dificultad": f["dificultad"],
                "tiempo_minutos": f["tiempo_minutos"],
                "porciones": f["porciones"],
                "tipo": f["tipo"],
                "pasos": pasos,
                "origen": f["origen"],
                "esenciales": [],
                "opcionales": [],
                "esenciales_obj": [],
                "opcionales_obj": [],
            }
        item = {
            "nombre": f["ingrediente_nombre"],
            "cantidad": f["cantidad"],
            "unidad": f["unidad"],
        }
        if f["esencial"]:
            agrupado[rid]["esenciales"].append(f["ingrediente_nombre"])
            agrupado[rid]["esenciales_obj"].append(item)
        else:
            agrupado[rid]["opcionales"].append(f["ingrediente_nombre"])
            agrupado[rid]["opcionales_obj"].append(item)

    resultados = []
    for receta in agrupado.values():
        esenciales = set(receta["esenciales"])
        opcionales = set(receta["opcionales"])
        if not esenciales:
            continue

        match = esenciales & ingredientes_efectivos
        faltantes = esenciales - ingredientes_efectivos
        porcentaje = len(match) / len(esenciales)

        usuario_usados_esenciales = ingredientes_norm & esenciales
        usuario_usados_opcionales = ingredientes_norm & opcionales
        usuario_usados = usuario_usados_esenciales | usuario_usados_opcionales
        porcentaje_aprovechamiento = (
            len(usuario_usados) / len(ingredientes_norm) if ingredientes_norm else 0
        )

        if not incluir_faltantes and faltantes:
            continue

        if excluir_norm and (esenciales & excluir_norm):
            continue

        if porcentaje < min_match:
            continue

        resultados.append({
            "receta": {
                "id": receta["id"],
                "nombre": receta["nombre"],
                "dificultad": receta["dificultad"],
                "tiempo_minutos": receta["tiempo_minutos"],
                "porciones": receta["porciones"],
                "tipo": receta["tipo"],
                "pasos": receta["pasos"],
                "origen": receta["origen"],
                "ingredientes_esenciales": receta["esenciales_obj"],
                "ingredientes_opcionales": receta["opcionales_obj"],
            },
            "ingredientes_match": sorted(match - INGREDIENTES_BASE),
            "ingredientes_faltantes": sorted(faltantes - INGREDIENTES_BASE),
            "porcentaje_match": round(porcentaje, 2),
            "porcentaje_aprovechamiento": round(porcentaje_aprovechamiento, 2),
            "ingredientes_aprovechados": sorted(usuario_usados - INGREDIENTES_BASE),
            "total_ingredientes_usuario": len(ingredientes_norm),
        })

    if modo_aprovechar:
        resultados.sort(
            key=lambda r: (
                -r["porcentaje_aprovechamiento"],
                -r["porcentaje_match"],
                len(r["ingredientes_faltantes"]),
                r["receta"]["tiempo_minutos"],
            )
        )
    else:
        resultados.sort(
            key=lambda r: (
                -r["porcentaje_match"],
                len(r["ingredientes_faltantes"]),
                r["receta"]["tiempo_minutos"],
            )
        )
    return resultados[:limite]
