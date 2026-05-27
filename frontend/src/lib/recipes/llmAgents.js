const ENDPOINTS = {
  claude: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
};

const MODELOS = {
  claude: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
};

const SYSTEM_PARSER = `Eres un chef que pone EN LIMPIO recetas escritas de cualquier manera
(informal, incompleta, jerga). Completas con sentido comun lo que falte.

REGLAS DE INGREDIENTES:
- Nombres simples y en singular: "pollo", "arroz", "tomate", "huevo".
- "cantidad" SIEMPRE es numero. Si la fuente dice "al gusto", usa cantidad: 0 y unidad: "al gusto".
- "unidad" debe ser una de: "g", "kg", "ml", "l", "unidad", "unidades", "cda", "cdita", "taza", "diente", "pizca", "al gusto".

REGLAS DE PASOS (MUY IMPORTANTE):
- Cada paso ESPECIFICO, no vago.
- OBLIGATORIO "tiempo_minutos" (numero >= 1) en pasos de coccion, horneado, hervido, marinado, reposo.
- Solo pasos puros de preparacion (picar/mezclar) pueden tener tiempo_minutos en null.

TEMPERATURA / FUEGO (OBLIGATORIO):
- HORNALLA: el texto DEBE decir el fuego: "bajo", "medio" o "alto".
- HORNO: el texto DEBE decir grados (ej: "200 grados").
- Cada paso al calor termina con una SENAL VISUAL ("hasta dorar", "hasta que rompa el hervor").

FORMATO (devuelve SOLO JSON, sin markdown):
{
  "nombre": "string corto",
  "ingredientes_esenciales": [{"nombre": "pollo", "cantidad": 500, "unidad": "g"}],
  "ingredientes_opcionales": [],
  "dificultad": "facil" | "media",
  "tiempo_minutos": numero (tiempo TOTAL),
  "porciones": numero,
  "tipo": "desayuno" | "almuerzo" | "cena" | "merienda" | "guarnicion" | "postres" | null,
  "pasos": [{"texto": "...", "tiempo_minutos": 5}]
}

Sin tildes ni caracteres especiales.`;

const SYSTEM_SUGGESTER = `Eres un chef que escribe recetas CASERAS REALES, SIMPLES pero DETALLADAS.

REGLA ABSOLUTA ANTI-TRIVIAL:
- Cada receta debe ser un PLATO RECONOCIBLE de cocina real.
- PROHIBIDO sugerir mezclas triviales que no son recetas (leche fria, agua con limon, X con azucar como receta sola).
- Si los ingredientes son pocos, asumi que el usuario tambien tiene harina, huevo, azucar, sal, pimienta, aceite, agua, manteca, leche, queso, ajo, cebolla y combina.

REGLAS DE INGREDIENTES:
- MINIMO 4 ingredientes por receta.
- Maximo 8, idealmente 4-6.
- Comunes de supermercado. Nada gourmet.
- Nombres en singular: "pollo", "arroz", "tomate", "huevo".
- "cantidad" siempre numero. Unidades: g, kg, ml, l, unidad, unidades, cda, cdita, taza, diente, pizca, al gusto.

REGLAS DE PASOS:
- Maximo 7 pasos, minimo 4.
- Cada paso ESPECIFICO. Coccion siempre con tiempo_minutos.
- HORNALLA: el texto incluye fuego (bajo/medio/alto).
- HORNO: el texto incluye grados.
- Cada paso al calor termina con senal visual.

FORMATO (devuelve SOLO JSON, sin markdown):
{
  "recetas": [{
    "nombre": "string corto",
    "ingredientes_esenciales": [{"nombre": "pollo", "cantidad": 400, "unidad": "g"}],
    "ingredientes_opcionales": [],
    "dificultad": "facil",
    "tiempo_minutos": 25,
    "porciones": 2,
    "tipo": "almuerzo" | "cena" | "desayuno" | "merienda" | "guarnicion" | "postres",
    "pasos": [{"texto": "...", "tiempo_minutos": 5}]
  }]
}

Sin tildes.`;

function limpiarJson(raw) {
  let contenido = String(raw).trim();
  if (contenido.startsWith('```')) {
    contenido = contenido.split('```')[1];
    if (contenido.startsWith('json')) contenido = contenido.slice(4);
    contenido = contenido.trim();
  }
  return contenido;
}

async function llamarLLM(provider, apiKey, system, userPrompt, maxTokens) {
  if (!apiKey) throw new Error('Falta la API key.');

  if (provider === 'claude') {
    const res = await fetch(ENDPOINTS.claude, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODELOS.claude,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Error ${res.status}`);
    }
    const data = await res.json();
    return data.content[0].text;
  }

  const url = ENDPOINTS[provider];
  const modelo = MODELOS[provider];
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function normalizarReceta(r) {
  const normIng = (i) => {
    if (typeof i === 'string') return { nombre: i, cantidad: 0, unidad: 'al gusto' };
    return {
      nombre: i.nombre || '',
      cantidad: Number(i.cantidad || 0),
      unidad: i.unidad || 'al gusto',
    };
  };
  const normPaso = (p) => {
    if (typeof p === 'string') return { texto: p, tiempo_minutos: null };
    return { texto: p.texto || '', tiempo_minutos: p.tiempo_minutos ?? null };
  };
  return {
    nombre: r.nombre,
    ingredientes_esenciales: (r.ingredientes_esenciales || []).map(normIng),
    ingredientes_opcionales: (r.ingredientes_opcionales || []).map(normIng),
    dificultad: r.dificultad || 'facil',
    tiempo_minutos: r.tiempo_minutos,
    porciones: r.porciones || 2,
    tipo: r.tipo || null,
    pasos: (r.pasos || []).map(normPaso),
  };
}

export async function parsearReceta(texto, provider, apiKey) {
  const raw = await llamarLLM(provider, apiKey, SYSTEM_PARSER,
    `Extrae la receta de este texto:\n\n${texto}`, 2000);
  const contenido = limpiarJson(raw);
  let receta;
  try {
    receta = JSON.parse(contenido);
  } catch (e) {
    throw new Error('El modelo devolvio JSON invalido.');
  }
  for (const c of ['nombre', 'ingredientes_esenciales', 'tiempo_minutos', 'pasos']) {
    if (!(c in receta)) throw new Error(`Falta el campo: ${c}`);
  }
  return normalizarReceta(receta);
}

export async function sugerirRecetas({ ingredientes, excluir = [], provider, apiKey, modoAprovechar = false }) {
  let excluirTxt = '';
  if (excluir.length > 0) {
    excluirTxt = `\n\nNO repitas estas recetas que ya existen: ${excluir.join(', ')}.`;
  }

  let modoTxt = '';
  if (modoAprovechar) {
    const minUso = Math.max(3, Math.floor(ingredientes.length / 2));
    modoTxt = `\n\nMODO APROVECHAR:
El usuario quiere usar la MAXIMA CANTIDAD POSIBLE de sus ingredientes.
Cada receta DEBE incluir al menos ${minUso} de los ingredientes del usuario como esenciales.
Priorizar combinaciones que aprovechen muchos ingredientes a la vez (guisos, tartas, salteados, rellenos, sopas).`;
  }

  const userPrompt = `El usuario tiene estos ingredientes: ${ingredientes.join(', ')}.

Genera EXACTAMENTE 3 ideas de recetas REALES, distintas entre si.
Cada receta DEBE usar de forma protagonica al menos uno de los ingredientes del usuario.
Asumi que tiene tambien harina, huevo, azucar, sal, pimienta, aceite, agua, manteca, leche, queso, ajo, cebolla.
Minimo 4 ingredientes y 4 pasos por receta.${modoTxt}

Cantidades para 2 porciones.${excluirTxt}`;

  const raw = await llamarLLM(provider, apiKey, SYSTEM_SUGGESTER, userPrompt, 3000);
  const contenido = limpiarJson(raw);
  let data;
  try {
    data = JSON.parse(contenido);
  } catch (e) {
    throw new Error('El modelo devolvio JSON invalido.');
  }

  const lista = data.recetas;
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new Error('Respuesta sin recetas.');
  }

  const validas = [];
  for (const r of lista) {
    try {
      for (const c of ['nombre', 'ingredientes_esenciales', 'tiempo_minutos', 'pasos']) {
        if (!(c in r)) throw new Error('incompleta');
      }
      const n = normalizarReceta(r);
      if (n.ingredientes_esenciales.length < 4) continue;
      if (n.pasos.length < 4) continue;
      validas.push(n);
    } catch { continue; }
  }

  if (validas.length === 0) {
    throw new Error('La IA no devolvio recetas validas. Probá de nuevo o cambiá los ingredientes.');
  }
  return validas;
}
