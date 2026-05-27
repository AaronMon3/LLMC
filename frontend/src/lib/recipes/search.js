import { normalizarLista } from './normalizer.js';

const INGREDIENTES_BASE = new Set([
  'sal', 'pimienta', 'aceite', 'agua', 'vinagre', 'azucar',
]);

function diferencia(a, b) {
  const out = new Set();
  for (const x of a) if (!b.has(x)) out.add(x);
  return out;
}

function interseccion(a, b) {
  const out = new Set();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

function union(a, b) {
  const out = new Set(a);
  for (const x of b) out.add(x);
  return out;
}

function ordenarSet(s) {
  return Array.from(s).sort();
}

export function buscarRecetas(recetas, {
  ingredientes = [],
  tiempoMax = null,
  dificultad = null,
  tipo = null,
  incluirFaltantes = true,
  excluir = [],
  minMatch = 0.5,
  modoAprovechar = false,
  limite = 20,
} = {}) {
  const ingNorm = new Set(normalizarLista(ingredientes));
  if (ingNorm.size === 0) return [];

  const excluirNorm = new Set(normalizarLista(excluir));
  const ingEfectivos = diferencia(union(ingNorm, INGREDIENTES_BASE), excluirNorm);

  const resultados = [];
  for (const receta of recetas) {
    if (tiempoMax != null && receta.tiempo_minutos > tiempoMax) continue;
    if (dificultad && receta.dificultad !== dificultad) continue;
    if (tipo && receta.tipo !== tipo) continue;

    const esenciales = new Set((receta.ingredientes_esenciales || []).map((i) => i.nombre));
    const opcionales = new Set((receta.ingredientes_opcionales || []).map((i) => i.nombre));
    if (esenciales.size === 0) continue;

    const match = interseccion(esenciales, ingEfectivos);
    const faltantes = diferencia(esenciales, ingEfectivos);
    const porcentaje = match.size / esenciales.size;

    const usadosEsenc = interseccion(ingNorm, esenciales);
    const usadosOpc = interseccion(ingNorm, opcionales);
    const usados = union(usadosEsenc, usadosOpc);
    const aprovechamiento = ingNorm.size > 0 ? usados.size / ingNorm.size : 0;

    if (!incluirFaltantes && faltantes.size > 0) continue;
    if (excluirNorm.size > 0 && interseccion(esenciales, excluirNorm).size > 0) continue;
    if (porcentaje < minMatch) continue;

    resultados.push({
      receta: {
        id: receta.id,
        nombre: receta.nombre,
        dificultad: receta.dificultad,
        tiempo_minutos: receta.tiempo_minutos,
        porciones: receta.porciones,
        tipo: receta.tipo,
        pasos: receta.pasos,
        origen: receta.origen,
        ingredientes_esenciales: receta.ingredientes_esenciales,
        ingredientes_opcionales: receta.ingredientes_opcionales,
      },
      ingredientes_match: ordenarSet(diferencia(match, INGREDIENTES_BASE)),
      ingredientes_faltantes: ordenarSet(diferencia(faltantes, INGREDIENTES_BASE)),
      porcentaje_match: Math.round(porcentaje * 100) / 100,
      porcentaje_aprovechamiento: Math.round(aprovechamiento * 100) / 100,
      ingredientes_aprovechados: ordenarSet(diferencia(usados, INGREDIENTES_BASE)),
      total_ingredientes_usuario: ingNorm.size,
    });
  }

  if (modoAprovechar) {
    resultados.sort((a, b) =>
      b.porcentaje_aprovechamiento - a.porcentaje_aprovechamiento ||
      b.porcentaje_match - a.porcentaje_match ||
      a.ingredientes_faltantes.length - b.ingredientes_faltantes.length ||
      a.receta.tiempo_minutos - b.receta.tiempo_minutos
    );
  } else {
    resultados.sort((a, b) =>
      b.porcentaje_match - a.porcentaje_match ||
      a.ingredientes_faltantes.length - b.ingredientes_faltantes.length ||
      a.receta.tiempo_minutos - b.receta.tiempo_minutos
    );
  }
  return resultados.slice(0, limite);
}
