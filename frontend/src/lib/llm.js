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

function buildSystem(receta) {
  const ingredientes = [
    ...receta.ingredientes_esenciales,
    ...receta.ingredientes_opcionales.map((i) => `${i} (opcional)`),
  ].join(', ');

  return `Sos un asistente de cocina amigable y conciso.
El usuario esta cocinando esta receta:

Nombre: ${receta.nombre}
Tiempo: ${receta.tiempo_minutos} min - Porciones: ${receta.porciones} - Dificultad: ${receta.dificultad}
Ingredientes: ${ingredientes}
Pasos:
${receta.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Responde dudas sobre esta receta de forma corta y practica (maximo 3 frases).
Solo responde sobre cocina. Si te preguntan otra cosa, redirige amablemente a la receta.`;
}

async function llamarClaude({ apiKey, system, mensajes }) {
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
      max_tokens: 400,
      system,
      messages: mensajes.map((m) => ({ role: m.rol, content: m.texto })),
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text.trim();
}

async function llamarOpenAICompatible(endpoint, modelo, { apiKey, system, mensajes }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 400,
      messages: [
        { role: 'system', content: system },
        ...mensajes.map((m) => ({ role: m.rol === 'assistant' ? 'assistant' : 'user', content: m.texto })),
      ],
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export async function preguntarAlChef({ provider, apiKey, receta, historial, pregunta }) {
  if (!apiKey) throw new Error('Falta la API key. Configurala en ajustes.');

  const system = buildSystem(receta);
  const mensajes = [...historial, { rol: 'user', texto: pregunta }];

  if (provider === 'openai') {
    return llamarOpenAICompatible(ENDPOINTS.openai, MODELOS.openai, { apiKey, system, mensajes });
  }
  if (provider === 'groq') {
    return llamarOpenAICompatible(ENDPOINTS.groq, MODELOS.groq, { apiKey, system, mensajes });
  }
  return llamarClaude({ apiKey, system, mensajes });
}
