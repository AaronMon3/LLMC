import { SPOTIFY_CONFIG } from './config.js';

const STORAGE_KEY = 'llmc_spotify_tokens';
const VERIFIER_KEY = 'llmc_spotify_verifier';
const STATE_KEY = 'llmc_spotify_state';
const RECORDAR_KEY = 'llmc_recordar_keys';

function debeRecordar() {
  try {
    const raw = localStorage.getItem(RECORDAR_KEY);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

function storageActivo() {
  return debeRecordar() ? localStorage : sessionStorage;
}

function leerTokensRaw() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = sessionStorage.getItem(STORAGE_KEY);
    return raw;
  } catch {
    return null;
  }
}

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

function generarState() {
  return base64UrlEncode(randomBytes(24));
}

async function calcularCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(hash));
}

function limpiarFlowState() {
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

function guardarFlowItem(clave, valor) {
  const storage = debeRecordar() ? localStorage : sessionStorage;
  storage.setItem(clave, valor);
  const otro = debeRecordar() ? sessionStorage : localStorage;
  otro.removeItem(clave);
}

function leerFlowItem(clave) {
  return localStorage.getItem(clave) || sessionStorage.getItem(clave);
}

export async function iniciarLogin() {
  const verifier = generarCodeVerifier();
  const challenge = await calcularCodeChallenge(verifier);
  const state = generarState();

  guardarFlowItem(VERIFIER_KEY, verifier);
  guardarFlowItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CONFIG.clientId,
    scope: SPOTIFY_CONFIG.scopes.join(' '),
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });

  window.location.href = `${SPOTIFY_CONFIG.authUrl}?${params.toString()}`;
}

export async function intercambiarCodigoPorTokens(code, stateRecibido) {
  const verifier = leerFlowItem(VERIFIER_KEY);
  const stateEsperado = leerFlowItem(STATE_KEY);

  if (!verifier) {
    limpiarFlowState();
    throw new Error('No hay code_verifier guardado. Reintentá la conexión.');
  }

  if (stateEsperado && stateRecibido && stateEsperado !== stateRecibido) {
    limpiarFlowState();
    throw new Error('Validación de state falló. Posible intento de CSRF.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    client_id: SPOTIFY_CONFIG.clientId,
    code_verifier: verifier,
  });

  try {
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
    return data;
  } finally {
    limpiarFlowState();
  }
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
  const json = JSON.stringify(obj);
  if (debeRecordar()) {
    localStorage.setItem(STORAGE_KEY, json);
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    sessionStorage.setItem(STORAGE_KEY, json);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function leerTokens() {
  try {
    const raw = leerTokensRaw();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function migrarTokensSegunRecordar() {
  const tokens = leerTokens();
  if (!tokens) return;
  guardarTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: Math.max(0, Math.floor((tokens.expires_at - Date.now()) / 1000) + 30),
    token_type: tokens.token_type,
    scope: tokens.scope,
  });
}

export function estaConectado() {
  const t = leerTokens();
  return !!t?.access_token;
}

export function cerrarSesion() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  limpiarFlowState();
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
