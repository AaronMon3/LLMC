import json

SYSTEM_PROMPT = """Eres un chef que escribe recetas CASERAS REALES, SIMPLES pero DETALLADAS.
Tu objetivo: que alguien que nunca cocino la receta pueda hacerla sin dudar.

REGLA ABSOLUTA ANTI-TRIVIAL (NO LA VIOLES NUNCA):
- Cada receta debe ser un PLATO RECONOCIBLE de cocina real, no una "ocurrencia".
- PROHIBIDO sugerir mezclas triviales que no son recetas:
  * "leche fria", "leche caliente", "agua con limon" → NO son recetas.
  * "X con azucar", "X con sal" como receta sola → NO.
  * Cualquier cosa que sea "echar un ingrediente sobre otro" sin coccion ni preparacion → NO.
  * Cosas que se hacen en menos de 3 minutos sin tecnica → NO.
- Si no podes pensar 3 recetas REALES con los ingredientes dados, PEDI ingredientes complementarios
  (asumis que el usuario tiene siempre harina, huevo, azucar, sal, pimienta, aceite, agua, manteca,
  leche, queso, ajo, cebolla) y sugeris recetas que combinen lo del usuario con esos basicos.
- Ejemplo: si te dicen "leche", no sugieras "leche con miel". Sugeri arroz con leche, panqueques,
  budin de pan, flan, mousse, leche con cacao calentita estilo postre, lechon, alfajores de maicena.

REGLAS DE INGREDIENTES:
- MINIMO 4 ingredientes por receta. Si tiene menos de 4, no es receta, es ocurrencia.
- Maximo 8 ingredientes, idealmente 4-6.
- Comunes de supermercado. Nada de gourmet (azafran, trufa, miso, etc).
- Nombres en singular: "pollo", "arroz", "tomate", "huevo".
- Cada ingrediente OBLIGATORIO: "nombre", "cantidad" (numero), "unidad".
- Unidades validas: g, kg, ml, l, unidad, unidades, cda, cdita, taza, diente, pizca, al gusto.
- Para sal/pimienta/aceite a discrecion: cantidad 0, unidad "al gusto".
- Cada receta debe tener MINIMO 4 pasos (sino no es una preparacion real).

REGLAS DE PASOS (MUY IMPORTANTE):
- Maximo 7 pasos por receta.
- Cada paso debe ser ESPECIFICO. NO vago.
- OBLIGATORIO incluir "tiempo_minutos" (numero entero >= 1) en CUALQUIER paso que implique:
  * cocinar, dorar, saltear, freir (incluso si son pocos minutos)
  * hervir, hornear, gratinar
  * marinar, leudar, reposar, enfriar
- Solo pasos puramente de preparacion (picar/mezclar/escurrir/escurrir/condimentar) pueden tener tiempo_minutos en null.

REGLAS DE TEMPERATURA / FUEGO (OBLIGATORIAS):
- Si el paso va a la HORNALLA: el texto DEBE decir el nivel de fuego: "bajo", "medio" o "alto".
- Si el paso va al HORNO: el texto DEBE decir la temperatura en grados (ej: "180 grados", "200 grados").
- Si es plancha/parrilla: usa "fuego alto" o "bien caliente".
- Cada paso al calor debe terminar con una SENAL VISUAL que indique cuando esta listo
  (ej: "hasta dorar", "hasta que la clara este firme", "hasta que rompa el hervor").

EJEMPLOS:

MAL: {"texto": "Saltear la carne.", "tiempo_minutos": null}
BIEN: {"texto": "Saltear la carne picada en una sarten a fuego alto hasta que pierda el color rosado.", "tiempo_minutos": 6}

MAL: {"texto": "Cocinar el arroz.", "tiempo_minutos": null}
BIEN: {"texto": "Cocinar el arroz a fuego bajo y tapado hasta que absorba el liquido.", "tiempo_minutos": 18}

MAL: {"texto": "Hornear.", "tiempo_minutos": 20}
BIEN: {"texto": "Hornear a 200 grados hasta que la superficie este dorada.", "tiempo_minutos": 25}

MAL: {"texto": "Hervir las papas.", "tiempo_minutos": 15}
BIEN: {"texto": "Hervir las papas a fuego medio en agua con sal hasta que esten tiernas al pincharlas con un tenedor.", "tiempo_minutos": 18}

FORMATO DE SALIDA (devuelve SOLO el JSON, sin markdown, sin texto adicional):
{
  "recetas": [
    {
      "nombre": "string corto",
      "ingredientes_esenciales": [{"nombre": "pollo", "cantidad": 400, "unidad": "g"}],
      "ingredientes_opcionales": [],
      "dificultad": "facil",
      "tiempo_minutos": 25,
      "porciones": 2,
      "tipo": "almuerzo" | "cena" | "desayuno" | "merienda" | "guarnicion" | "postres",
      "pasos": [{"texto": "...", "tiempo_minutos": 5}]
    }
  ]
}

Sin tildes ni caracteres especiales en los textos."""


def _build_user_prompt(ingredientes: list[str], excluir: list[str]) -> str:
    excluir_txt = ""
    if excluir:
        excluir_txt = f"\n\nNO repitas estas recetas que ya existen: {', '.join(excluir)}."

    return f"""El usuario tiene estos ingredientes en casa: {', '.join(ingredientes)}.

Genera EXACTAMENTE 3 ideas de recetas REALES, distintas entre si.
Cada receta DEBE usar de forma protagonica al menos uno de los ingredientes del usuario.
Asumi que el usuario tiene en su despensa basica: harina, huevo, azucar, sal, pimienta, aceite, agua, manteca, leche, queso, ajo, cebolla.
Podes incorporar esos basicos en las recetas si la lista del usuario es chica.

NO sugieras combinaciones triviales (mezclar dos cosas sin coccion no es una receta).
Cada receta debe tener minimo 4 ingredientes y minimo 4 pasos de preparacion.

Las cantidades deben ser para 2 porciones.{excluir_txt}"""


def _llamar_claude(ingredientes: list[str], excluir: list[str], api_key: str) -> str:
    from anthropic import Anthropic
    client = Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_user_prompt(ingredientes, excluir)}],
    )
    return response.content[0].text.strip()


def _llamar_openai(ingredientes: list[str], excluir: list[str], api_key: str) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=3000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(ingredientes, excluir)},
        ],
    )
    return response.choices[0].message.content.strip()


def _llamar_groq(ingredientes: list[str], excluir: list[str], api_key: str) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=3000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(ingredientes, excluir)},
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


def _normalizar_receta(r: dict) -> dict:
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

    r["ingredientes_esenciales"] = [norm_ing(i) for i in r.get("ingredientes_esenciales", [])]
    r["ingredientes_opcionales"] = [norm_ing(i) for i in r.get("ingredientes_opcionales", [])]
    r["pasos"] = [norm_paso(p) for p in r.get("pasos", [])]
    r.setdefault("dificultad", "facil")
    r.setdefault("porciones", 2)
    r.setdefault("tipo", None)
    return r


def sugerir_recetas(
    ingredientes: list[str],
    excluir: list[str],
    api_key: str,
    provider: str = "claude",
) -> list[dict]:
    if provider == "openai":
        raw = _llamar_openai(ingredientes, excluir, api_key)
    elif provider == "groq":
        raw = _llamar_groq(ingredientes, excluir, api_key)
    else:
        raw = _llamar_claude(ingredientes, excluir, api_key)

    contenido = _limpiar_json(raw)
    try:
        data = json.loads(contenido)
    except json.JSONDecodeError as e:
        raise ValueError(f"Respuesta no es JSON valido: {e}\n{contenido}")

    recetas = data.get("recetas", [])
    if not isinstance(recetas, list) or not recetas:
        raise ValueError("La respuesta no contiene una lista de recetas.")

    validas = []
    for r in recetas:
        try:
            for campo in ["nombre", "ingredientes_esenciales", "tiempo_minutos", "pasos"]:
                if campo not in r:
                    raise ValueError(f"falta {campo}")
            normalizada = _normalizar_receta(r)
            if len(normalizada["ingredientes_esenciales"]) < 4:
                continue
            if len(normalizada["pasos"]) < 4:
                continue
            validas.append(normalizada)
        except (ValueError, KeyError):
            continue

    if not validas:
        raise ValueError(
            "El modelo no devolvio recetas validas con los ingredientes dados. "
            "Proba con mas ingredientes o intenta de nuevo."
        )

    return validas
