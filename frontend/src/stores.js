import { writable, get } from 'svelte/store';

function persistente(clave, valorInicial) {
  const inicial = (() => {
    try {
      const raw = localStorage.getItem(clave);
      return raw ? JSON.parse(raw) : valorInicial;
    } catch {
      return valorInicial;
    }
  })();

  const store = writable(inicial);
  store.subscribe((valor) => {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {}
  });
  return store;
}

/**
 * Storage hibrido para datos sensibles (API keys, tokens).
 * - Recordar OFF (default): sessionStorage (vive solo en la pestaña actual)
 * - Recordar ON: localStorage (persistente entre sesiones)
 * Migra automaticamente al cambiar el toggle.
 */
function leerSensible(clave) {
  try {
    let raw = localStorage.getItem(clave);
    if (!raw) raw = sessionStorage.getItem(clave);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function escribirSensible(clave, valor, recordar) {
  try {
    const json = JSON.stringify(valor);
    if (recordar) {
      localStorage.setItem(clave, json);
      sessionStorage.removeItem(clave);
    } else {
      sessionStorage.setItem(clave, json);
      localStorage.removeItem(clave);
    }
  } catch {}
}

function persistenteSensible(clave, valorInicial) {
  const inicial = leerSensible(clave) ?? valorInicial;
  const store = writable(inicial);
  store.subscribe((valor) => {
    const recordar = get(recordarKeys);
    escribirSensible(clave, valor, recordar);
  });
  return store;
}

export const PROVIDERS = {
  groq: { nombre: 'Groq (gratis)', modelo: 'llama-3.3-70b-versatile', urlKey: 'https://console.groq.com/keys' },
  claude: { nombre: 'Claude (Anthropic)', modelo: 'claude-haiku-4-5-20251001', urlKey: 'https://console.anthropic.com' },
  openai: { nombre: 'OpenAI', modelo: 'gpt-4o-mini', urlKey: 'https://platform.openai.com/api-keys' },
};

// Toggle: ¿guardar API keys/tokens entre sesiones? Default: NO
export const recordarKeys = persistente('llmc_recordar_keys', false);

export const llmConfig = persistenteSensible('llmc_llm_config', {
  provider: 'groq',
  keys: { groq: '', claude: '', openai: '' },
});

// Cuando cambia el toggle, migrar el contenido actual al storage correspondiente
recordarKeys.subscribe((recordar) => {
  try {
    const cfg = get(llmConfig);
    escribirSensible('llmc_llm_config', cfg, recordar);
  } catch {}
});

export const favoritos = persistente('llmc_favoritos', []);
export const historial = persistente('llmc_historial', []);

export const despensa = persistente('llmc_despensa', []);
export const restricciones = persistente('llmc_restricciones', []);
export const porcionesObjetivo = persistente('llmc_porciones_objetivo', 2);
export const historialBusquedas = persistente('llmc_historial_busquedas', []);
export const busquedasGuardadas = persistente('llmc_busquedas_guardadas', []);
export const listaCompras = persistente('llmc_lista_compras', []);
export const spotifyUrl = persistente('llmc_spotify_url', '');
import { estaConectado as _spotifyConectado } from './lib/spotify/auth.js';
export const spotifyConectado = writable(_spotifyConectado());

export function agregarALista(items) {
  listaCompras.update((lista) => {
    const map = new Map();
    for (const it of lista) {
      const key = `${it.nombre}__${it.unidad}`;
      map.set(key, { ...it });
    }
    for (const it of items) {
      const key = `${it.nombre}__${it.unidad}`;
      if (map.has(key)) {
        const ex = map.get(key);
        ex.cantidad = (ex.cantidad || 0) + (it.cantidad || 0);
      } else {
        map.set(key, {
          nombre: it.nombre,
          cantidad: it.cantidad || 0,
          unidad: it.unidad || 'al gusto',
          marcado: false,
        });
      }
    }
    return Array.from(map.values());
  });
}

export function toggleFavorito(recetaId) {
  favoritos.update((lista) => {
    if (lista.includes(recetaId)) return lista.filter((id) => id !== recetaId);
    return [...lista, recetaId];
  });
}

export function agregarAlHistorial(receta) {
  historial.update((lista) => {
    const filtrada = lista.filter((r) => r.id !== receta.id);
    return [{ id: receta.id, nombre: receta.nombre, fecha: Date.now() }, ...filtrada].slice(0, 20);
  });
}

export function agregarBusquedaHistorial(ingredientes) {
  if (!ingredientes.length) return;
  const clave = [...ingredientes].sort().join('|');
  historialBusquedas.update((lista) => {
    const filtrada = lista.filter((b) => [...b.ingredientes].sort().join('|') !== clave);
    return [{ ingredientes, fecha: Date.now() }, ...filtrada].slice(0, 8);
  });
}

export function getKeyActiva(config) {
  return config?.keys?.[config.provider] || '';
}

/**
 * Borra TODOS los datos locales: API keys, tokens, recetas cargadas,
 * favoritos, lista de compras, historial, IndexedDB de recetas.
 */
export async function borrarTodosLosDatos() {
  const claves = [
    'llmc_recordar_keys', 'llmc_llm_config',
    'llmc_favoritos', 'llmc_historial',
    'llmc_despensa', 'llmc_restricciones', 'llmc_porciones_objetivo',
    'llmc_historial_busquedas', 'llmc_busquedas_guardadas',
    'llmc_lista_compras', 'llmc_spotify_url',
    'llmc_spotify_tokens', 'llmc_spotify_verifier', 'llmc_spotify_state',
    'llmc_ultimos_ingredientes',
  ];
  for (const k of claves) {
    try { localStorage.removeItem(k); } catch {}
    try { sessionStorage.removeItem(k); } catch {}
  }

  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const d of dbs) {
        if (d.name) indexedDB.deleteDatabase(d.name);
      }
    } else {
      indexedDB.deleteDatabase('llmc_recipes');
    }
  } catch {}
}
