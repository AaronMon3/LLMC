import json
import unicodedata
from pathlib import Path
from functools import lru_cache

SINONIMOS_PATH = Path(__file__).parent / "data" / "sinonimos.json"


def quitar_acentos(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def limpiar(texto: str) -> str:
    return quitar_acentos(texto.strip().lower())


@lru_cache(maxsize=1)
def cargar_mapa_sinonimos() -> dict[str, str]:
    with open(SINONIMOS_PATH, encoding="utf-8") as f:
        sinonimos = json.load(f)

    mapa = {}
    for canonico, alias_list in sinonimos.items():
        clave_canonica = limpiar(canonico)
        mapa[clave_canonica] = clave_canonica
        for alias in alias_list:
            mapa[limpiar(alias)] = clave_canonica
    return mapa


def normalizar_ingrediente(texto: str) -> str:
    if not texto:
        return ""
    limpio = limpiar(texto)
    mapa = cargar_mapa_sinonimos()
    return mapa.get(limpio, limpio)


def normalizar_lista(textos: list[str]) -> list[str]:
    vistos = set()
    resultado = []
    for t in textos:
        norm = normalizar_ingrediente(t)
        if norm and norm not in vistos:
            vistos.add(norm)
            resultado.append(norm)
    return resultado


def parsear_input_usuario(texto: str) -> list[str]:
    separadores = [",", ";", "\n", "/", "|", " y ", " con ", " mas ", "+", "&"]
    partes = [texto]
    for sep in separadores:
        nuevas = []
        for p in partes:
            nuevas.extend(p.split(sep))
        partes = nuevas
    return normalizar_lista([p for p in partes if p.strip()])
