/**
 * Helpers para parsear URLs/URIs de Spotify y generar embeds + deep links.
 * Soporta playlist, album, track, episode, show.
 */

const TIPOS_VALIDOS = ['playlist', 'album', 'track', 'episode', 'show'];

export function parsearSpotifyUrl(input) {
  if (!input) return null;
  const txt = String(input).trim();

  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const uriMatch = txt.match(/^spotify:(\w+):([a-zA-Z0-9]+)/);
  if (uriMatch && TIPOS_VALIDOS.includes(uriMatch[1])) {
    return { tipo: uriMatch[1], id: uriMatch[2] };
  }

  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
  try {
    const url = new URL(txt);
    if (!url.hostname.includes('spotify.com')) return null;
    const partes = url.pathname.split('/').filter(Boolean);
    let tipo = null;
    let id = null;
    for (let i = 0; i < partes.length; i++) {
      if (TIPOS_VALIDOS.includes(partes[i]) && partes[i + 1]) {
        tipo = partes[i];
        id = partes[i + 1].split('?')[0];
        break;
      }
    }
    if (!tipo || !id) return null;
    return { tipo, id };
  } catch {
    return null;
  }
}

export function urlEmbed(input) {
  const p = parsearSpotifyUrl(input);
  if (!p) return null;
  return `https://open.spotify.com/embed/${p.tipo}/${p.id}?utm_source=generator`;
}

export function urlAppNativa(input) {
  const p = parsearSpotifyUrl(input);
  if (!p) return null;
  return `spotify://${p.tipo}/${p.id}`;
}

export function urlAbrirWeb(input) {
  const p = parsearSpotifyUrl(input);
  if (!p) return null;
  return `https://open.spotify.com/${p.tipo}/${p.id}`;
}

export function descripcionContenido(input) {
  const p = parsearSpotifyUrl(input);
  if (!p) return null;
  const nombres = {
    playlist: 'Playlist',
    album: 'Álbum',
    track: 'Canción',
    episode: 'Episodio',
    show: 'Podcast',
  };
  return nombres[p.tipo] || p.tipo;
}
