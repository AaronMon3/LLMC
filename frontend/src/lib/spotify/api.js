import { SPOTIFY_CONFIG } from './config.js';
import { getAccessTokenValido, cerrarSesion } from './auth.js';

async function call(path, opciones = {}) {
  const token = await getAccessTokenValido();
  if (!token) throw new Error('No autenticado con Spotify.');

  const url = path.startsWith('http') ? path : `${SPOTIFY_CONFIG.apiBase}${path}`;
  const res = await fetch(url, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.headers || {}),
    },
  });

  if (res.status === 401) {
    cerrarSesion();
    throw new Error('Sesion expirada. Reconectate con Spotify.');
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify API ${res.status}: ${txt}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getPerfil() {
  return call('/me');
}

export async function getPlaylists(limit = 50) {
  const items = [];
  let url = `/me/playlists?limit=${limit}`;
  while (url && items.length < 200) {
    const data = await call(url);
    items.push(...(data.items || []));
    url = data.next ? data.next.replace(SPOTIFY_CONFIG.apiBase, '') : null;
  }
  return items;
}

export async function getTopTracks(timeRange = 'medium_term', limit = 20) {
  const data = await call(`/me/top/tracks?time_range=${timeRange}&limit=${limit}`);
  return data.items || [];
}

export async function getTopArtists(timeRange = 'medium_term', limit = 20) {
  const data = await call(`/me/top/artists?time_range=${timeRange}&limit=${limit}`);
  return data.items || [];
}

export async function getRecientes(limit = 20) {
  const data = await call(`/me/player/recently-played?limit=${limit}`);
  return data.items || [];
}

export function deeplinkSpotify(uri) {
  if (!uri) return null;
  const partes = String(uri).match(/^spotify:(\w+):([a-zA-Z0-9]+)$/);
  if (!partes) return null;
  return `spotify://${partes[1]}/${partes[2]}`;
}

export function webSpotify(uri) {
  if (!uri) return null;
  const partes = String(uri).match(/^spotify:(\w+):([a-zA-Z0-9]+)$/);
  if (!partes) return null;
  return `https://open.spotify.com/${partes[1]}/${partes[2]}`;
}
