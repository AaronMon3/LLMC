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

const SYSTEM_PROMPT = `Eres un curador musical. Te paso los gustos de un usuario
(top artistas, generos que escucha mas, sus playlists) y tenes que recomendarle
UNA opcion de SU PROPIA biblioteca para escuchar mientras cocina.

REGLAS:
- Elegi de las playlists que el usuario YA TIENE.
- Justifica brevemente por que esa playlist (en 1-2 frases conectando con sus gustos).
- NO inventes playlists ni recomendaciones externas.
- Si las playlists del usuario son muy variadas, elegi una de mood relajado/medio (apto cocina).

Devuelve SOLO JSON con esta estructura:
{
  "playlist_id": "id de la playlist elegida (del JSON que te paso)",
  "razon": "breve justificacion"
}`;

function limpiarJson(raw) {
  let c = String(raw).trim();
  if (c.startsWith('```')) {
    c = c.split('```')[1];
    if (c.startsWith('json')) c = c.slice(4);
    c = c.trim();
  }
  return c;
}

async function llamarLLM(provider, apiKey, system, userPrompt) {
  if (!apiKey) throw new Error('Falta API key del LLM.');

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
        max_tokens: 500,
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
      max_tokens: 500,
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

export async function sugerirPlaylist({
  topArtistas, topTracks, playlists, provider, apiKey,
}) {
  if (!Array.isArray(playlists) || playlists.length === 0) {
    throw new Error('No hay playlists del usuario.');
  }

  const playlistsResumen = playlists.slice(0, 50).map((p) => ({
    id: p.id,
    name: p.name,
    descripcion: p.description || '',
    cantidad_tracks: p.tracks?.total ?? 0,
  }));

  const artistasResumen = (topArtistas || []).slice(0, 15).map((a) => ({
    nombre: a.name,
    generos: a.genres,
  }));

  const tracksResumen = (topTracks || []).slice(0, 15).map((t) => ({
    nombre: t.name,
    artista: t.artists?.map((a) => a.name).join(', '),
  }));

  const userPrompt = `Gustos del usuario:

ARTISTAS QUE MAS ESCUCHA:
${JSON.stringify(artistasResumen, null, 2)}

CANCIONES TOP RECIENTES:
${JSON.stringify(tracksResumen, null, 2)}

SUS PLAYLISTS DISPONIBLES (elegi una de aca):
${JSON.stringify(playlistsResumen, null, 2)}

Elegi UNA playlist de SU biblioteca que matchee mejor con sus gustos para cocinar.
Devolve SOLO el JSON pedido.`;

  const raw = await llamarLLM(provider, apiKey, SYSTEM_PROMPT, userPrompt);
  const contenido = limpiarJson(raw);

  let data;
  try {
    data = JSON.parse(contenido);
  } catch {
    throw new Error('El LLM devolvio JSON invalido.');
  }

  if (!data.playlist_id) throw new Error('Falta playlist_id en la respuesta.');

  const playlist = playlists.find((p) => p.id === data.playlist_id);
  if (!playlist) {
    throw new Error('El LLM eligio una playlist inexistente.');
  }

  return {
    playlist,
    razon: data.razon || '',
  };
}
