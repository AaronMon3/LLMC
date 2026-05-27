import json

SYSTEM_PROMPT = """Eres un chef que pone EN LIMPIO recetas escritas de cualquier manera
(informal, incompleta, jerga). Completas con sentido comun lo que falte, manteniendo
el espiritu de la receta original. Si la fuente es vaga, dale precision razonable.

REGLAS DE INGREDIENTES:
- Nombres simples y en singular: "pollo", "arroz", "tomate", "huevo".
- "cantidad" SIEMPRE es numero. Si la fuente dice "al gusto", usa cantidad: 0 y unidad: "al gusto".
- "unidad" debe ser una de: "g", "kg", "ml", "l", "unidad", "unidades", "cda", "cdita", "taza", "diente", "pizca", "al gusto".
- Si la fuente dice "2 tomates" → cantidad: 2, unidad: "unidades", nombre: "tomate".
- Si dice "una pizca de sal" → cantidad: 1, unidad: "pizca", nombre: "sal".

REGLAS DE PASOS (MUY IMPORTANTE):
- Cada paso debe ser ESPECIFICO. NO vago.
- OBLIGATORIO incluir "tiempo_minutos" (numero entero >= 1) en CUALQUIER paso que implique:
  * cocinar, dorar, saltear, freir (estimalo si la fuente no lo dice)
  * hervir, hornear, gratinar
  * marinar, leudar, reposar, enfriar
- Solo pasos puramente de preparacion (picar/mezclar/escurrir/condimentar) pueden tener tiempo_minutos en null.

REGLAS DE TEMPERATURA / FUEGO (OBLIGATORIAS, completalas si la fuente no las dice):
- Si el paso va a la HORNALLA: el texto DEBE decir el fuego: "bajo", "medio" o "alto".
- Si el paso va al HORNO: el texto DEBE decir la temperatura en grados (ej: "180 grados", "200 grados").
- Si es plancha/parrilla: "fuego alto" o "bien caliente".
- Cada paso al calor termina con una SENAL VISUAL ("hasta dorar", "hasta que rompa el hervor", "hasta que el queso se derrita").

EJEMPLOS DE TRANSFORMACION:

Fuente: "Tirar el pollo a la sarten"
JSON: {"texto": "Cocinar el pollo en una sarten a fuego medio hasta dorar de ambos lados.", "tiempo_minutos": 8}

Fuente: "Cocinar 20 min"
JSON: {"texto": "Cocinar a fuego bajo y tapado hasta que el liquido se reduzca.", "tiempo_minutos": 20}

Fuente: "Hornear"
JSON: {"texto": "Hornear a 200 grados hasta que la superficie este dorada.", "tiempo_minutos": 25}

Fuente: "Freir un huevo"
JSON: {"texto": "Freir el huevo en una sarten chica con aceite caliente a fuego medio hasta que la clara este firme.", "tiempo_minutos": 3}

FORMATO DE SALIDA (devuelve SOLO el JSON, sin markdown):
{
  "nombre": "string corto descriptivo",
  "ingredientes_esenciales": [{"nombre": "pollo", "cantidad": 500, "unidad": "g"}],
  "ingredientes_opcionales": [],
  "dificultad": "facil" o "media",
  "tiempo_minutos": numero entero (tiempo TOTAL),
  "porciones": numero entero,
  "tipo": "desayuno" | "almuerzo" | "cena" | "merienda" | "guarnicion" | "postres" | null,
  "pasos": [{"texto": "...", "tiempo_minutos": 5}]
}

Sin tildes ni caracteres especiales."""

USER_TEMPLATE = "Extrae la receta de este texto:\n\n{texto}"


def _llamar_claude(texto: str, api_key: str) -> str:
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": USER_TEMPLATE.format(texto=texto)}],
    )
    return response.content[0].text.strip()


def _llamar_openai(texto: str, api_key: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=2000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_TEMPLATE.format(texto=texto)},
        ],
    )
    return response.choices[0].message.content.strip()


def _llamar_groq(texto: str, api_key: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=2000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_TEMPLATE.format(texto=texto)},
        ],
    )
    return response.choices[0].message.content.strip()


def _limpiar_json(raw: str) -> str:
    contenido = raw.strip()
    if contenido.startswith("```"):
        contenido = contenido.split("```")[1]
        if contenido.startswith("json"):
            contenido = contenido[4:]
        contenido = contenido.strip()
    return contenido


def _normalizar(receta: dict) -> dict:
    def norm_ing(i):
        if isinstance(i, str):
            return {"nombre": i, "cantidad": 0, "unidad": "al gusto"}
        return {
            "nombre": i.get("nombre", ""),
            "cantidad": float(i.get("cantidad", 0) or 0),
            "unidad": i.get("unidad") or "al gusto",
        }

    def norm_paso(p):
        if isinstance(p, str):
            return {"texto": p, "tiempo_minutos": None}
        return {
            "texto": p.get("texto", ""),
            "tiempo_minutos": p.get("tiempo_minutos"),
        }

    receta["ingredientes_esenciales"] = [norm_ing(i) for i in receta.get("ingredientes_esenciales", [])]
    receta["ingredientes_opcionales"] = [norm_ing(i) for i in receta.get("ingredientes_opcionales", [])]
    receta["pasos"] = [norm_paso(p) for p in receta.get("pasos", [])]
    receta.setdefault("dificultad", "facil")
    receta.setdefault("porciones", 2)
    receta.setdefault("tipo", None)
    return receta


def parsear_receta(texto: str, api_key: str, provider: str = "claude") -> dict:
    if provider == "openai":
        raw = _llamar_openai(texto, api_key)
    elif provider == "groq":
        raw = _llamar_groq(texto, api_key)
    else:
        raw = _llamar_claude(texto, api_key)

    contenido = _limpiar_json(raw)

    try:
        receta = json.loads(contenido)
    except json.JSONDecodeError as e:
        raise ValueError(f"La respuesta del modelo no es JSON valido: {e}\n{contenido}")

    requeridos = ["nombre", "ingredientes_esenciales", "tiempo_minutos", "pasos"]
    for campo in requeridos:
        if campo not in receta:
            raise ValueError(f"Falta el campo requerido: {campo}")

    return _normalizar(receta)
