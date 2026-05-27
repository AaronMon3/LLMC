import {
  seedSiVacia, obtenerTodas, obtenerPorId, listarMeta,
  crear, borrar, listarIngredientesConocidos,
} from './recipes/storage.js';
import { buscarRecetas } from './recipes/search.js';
import { parsearReceta, sugerirRecetas } from './recipes/llmAgents.js';
import { parsearInputUsuario } from './recipes/normalizer.js';

let inicializado = null;
function asegurarInit() {
  if (!inicializado) inicializado = seedSiVacia();
  return inicializado;
}

export const api = {
  async buscar(ingredientes, filtros = {}) {
    await asegurarInit();
    const todas = await obtenerTodas();
    const resultados = buscarRecetas(todas, {
      ingredientes,
      tiempoMax: filtros.tiempo_max ?? null,
      dificultad: filtros.dificultad ?? null,
      tipo: filtros.tipo ?? null,
      incluirFaltantes: filtros.incluir_faltantes !== false,
      excluir: filtros.excluir ?? [],
      minMatch: filtros.min_match ?? 0.5,
      modoAprovechar: filtros.modo_aprovechar ?? false,
    });
    return { resultados, total: resultados.length };
  },

  async obtenerReceta(id) {
    await asegurarInit();
    const r = await obtenerPorId(id);
    if (!r) throw new Error('Receta no encontrada');
    return r;
  },

  async listarRecetas(filtros = {}) {
    await asegurarInit();
    return listarMeta(filtros);
  },

  async listarIngredientes() {
    await asegurarInit();
    return listarIngredientesConocidos();
  },

  async crearReceta(receta) {
    await asegurarInit();
    return crear(receta);
  },

  async borrarReceta(id) {
    await asegurarInit();
    return borrar(id);
  },

  async parsearReceta(texto, provider, apiKey) {
    return parsearReceta(texto, provider, apiKey);
  },

  async sugerirRecetas(ingredientes, excluir, provider, apiKey, modoAprovechar = false) {
    const recetas = await sugerirRecetas({ ingredientes, excluir, provider, apiKey, modoAprovechar });
    return { recetas };
  },

  parsearInputUsuario,
};
