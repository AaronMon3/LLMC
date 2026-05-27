import sinonimos from './sinonimos.json';

function quitarAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function limpiar(texto) {
  return quitarAcentos(String(texto || '').trim().toLowerCase());
}

let mapaCache = null;

function cargarMapa() {
  if (mapaCache) return mapaCache;
  const mapa = {};
  for (const [canonico, aliases] of Object.entries(sinonimos)) {
    const claveCanonica = limpiar(canonico);
    mapa[claveCanonica] = claveCanonica;
    for (const alias of aliases) {
      mapa[limpiar(alias)] = claveCanonica;
    }
  }
  mapaCache = mapa;
  return mapa;
}

export function normalizarIngrediente(texto) {
  if (!texto) return '';
  const limpio = limpiar(texto);
  return cargarMapa()[limpio] || limpio;
}

export function normalizarLista(textos) {
  const vistos = new Set();
  const resultado = [];
  for (const t of textos || []) {
    const norm = normalizarIngrediente(t);
    if (norm && !vistos.has(norm)) {
      vistos.add(norm);
      resultado.push(norm);
    }
  }
  return resultado;
}

export function parsearInputUsuario(texto) {
  if (!texto) return [];
  const separadores = [',', ';', '\n', '/', '|', ' y ', ' con ', ' mas ', '+', '&'];
  let partes = [texto];
  for (const sep of separadores) {
    const nuevas = [];
    for (const p of partes) nuevas.push(...p.split(sep));
    partes = nuevas;
  }
  return normalizarLista(partes.filter((p) => p.trim()));
}
