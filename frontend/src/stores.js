import { writable } from 'svelte/store';

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

export const PROVIDERS = {
  groq: { nombre: 'Groq (gratis)', modelo: 'llama-3.3-70b-versatile', urlKey: 'https://console.groq.com/keys' },
  claude: { nombre: 'Claude (Anthropic)', modelo: 'claude-haiku-4-5-20251001', urlKey: 'https://console.anthropic.com' },
  openai: { nombre: 'OpenAI', modelo: 'gpt-4o-mini', urlKey: 'https://platform.openai.com/api-keys' },
};

export const llmConfig = persistente('llmc_llm_config', {
  provider: 'groq',
  keys: { groq: '', claude: '', openai: '' },
});

export const favoritos = persistente('llmc_favoritos', []);
export const historial = persistente('llmc_historial', []);

export const despensa = persistente('llmc_despensa', []);
export const restricciones = persistente('llmc_restricciones', []);
export const porcionesObjetivo = persistente('llmc_porciones_objetivo', 2);
export const historialBusquedas = persistente('llmc_historial_busquedas', []);
export const busquedasGuardadas = persistente('llmc_busquedas_guardadas', []);

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
