import { SPOTIFY_CONFIG } from './config.js';

const STORAGE_KEY = 'llmc_spotify_tokens';
const VERIFIER_KEY = 'llmc_spotify_verifier';

function base64UrlEncode(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBytes(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

function generarCodeVerifier() {
  return base64UrlEncode(randomBytes(64)).slice(0, 128);
}

async function calcularCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(hash));
}

export async function iniciarLogin() {
  const verifier = generarCodeVerifier();
  const challenge = await calcularCodeChallenge(verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CONFIG.clientId,
    scope: SPOTIFY_CONFIG.scopes.join(' '),
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  const url = `${SPOTIFY_CONFIG.authUrl}?${params.toString()}`;
  window.location.href = url;
}

export async function abrirLoginExterno() {
  const verifier = generarCodeVerifier();
  const challenge = await calcularCodeChallenge(verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CONFIG.clientId,
    scope: SPOTIFY_CONFIG.scopes.join(' '),
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  return `${SPOTIFY_CONFIG.authUrl}?${params.toString()}`;
}

export async function intercambiarCodigoPorTokens(code) {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('No hay code_verifier guardado.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    client_id: SPOTIFY_CONFIG.clientId,
    code_verifier: verifier,
  });

  const res = await fetch(SPOTIFY_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify token error: ${res.status} ${txt}`);
  }

  const data = await res.json();
  guardarTokens(data);
  localStorage.removeItem(VERIFIER_KEY);
  return data;
}

export async function refrescarTokens() {
  const stored = leerTokens();
  if (!stored?.refresh_token) throw new Error('No hay refresh_token.');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: stored.refresh_token,
    client_id: SPOTIFY_CONFIG.clientId,
  });

  const res = await fetch(SPOTIFY_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    cerrarSesion();
    throw new Error(`Refresh failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  guardarTokens({ ...stored, ...data });
  return data;
}

function guardarTokens(data) {
  const obj = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || leerTokens()?.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000 - 30000,
    token_type: data.token_type,
    scope: data.scope,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export function leerTokens() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function estaConectado() {
  const t = leerTokens();
  return !!t?.access_token;
}

export function cerrarSesion() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
}

export async function getAccessTokenValido() {
  const t = leerTokens();
  if (!t) return null;
  if (Date.now() < t.expires_at) return t.access_token;
  try {
    const nuevo = await refrescarTokens();
    return nuevo.access_token;
  } catch {
    return null;
  }
}
