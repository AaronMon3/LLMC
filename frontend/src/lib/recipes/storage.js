import seedData from './seed.json';
import { normalizarLista } from './normalizer.js';

const DB_NAME = 'llmc_recipes';
const DB_VERSION = 1;
const STORE = 'recetas';

let dbPromise = null;

function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('nombre', 'nombre', { unique: false });
        store.createIndex('tipo', 'tipo', { unique: false });
        store.createIndex('origen', 'origen', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(modo) {
  const db = await abrirDB();
  return db.transaction(STORE, modo).objectStore(STORE);
}

function promiseRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function seedSiVacia() {
  const store = await tx('readonly');
  const count = await promiseRequest(store.count());
  if (count > 0) return { insertadas: 0, total: count };

  const writeStore = await tx('readwrite');
  let insertadas = 0;
  for (const receta of seedData) {
    const limpia = { ...receta };
    delete limpia.id;
    writeStore.add(limpia);
    insertadas++;
  }
  return new Promise((resolve, reject) => {
    writeStore.transaction.oncomplete = () => resolve({ insertadas, total: insertadas });
    writeStore.transaction.onerror = () => reject(writeStore.transaction.error);
  });
}

export async function obtenerTodas() {
  const store = await tx('readonly');
  return promiseRequest(store.getAll());
}

export async function obtenerPorId(id) {
  const store = await tx('readonly');
  return promiseRequest(store.get(Number(id)));
}

export async function listarMeta({ q, tipo } = {}) {
  const todas = await obtenerTodas();
  const ql = q ? q.toLowerCase() : null;
  return todas
    .filter((r) => (!tipo || r.tipo === tipo) && (!ql || r.nombre.toLowerCase().includes(ql)))
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      dificultad: r.dificultad,
      tiempo_minutos: r.tiempo_minutos,
      porciones: r.porciones,
      tipo: r.tipo,
      origen: r.origen,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function normalizarIngredientes(items) {
  const vistos = new Set();
  const salida = [];
  for (const it of items || []) {
    const nombre = typeof it === 'string' ? it : it.nombre || '';
    const cantidad = typeof it === 'string' ? 0 : Number(it.cantidad || 0);
    const unidad = typeof it === 'string' ? 'al gusto' : (it.unidad || 'al gusto');
    const nombresNorm = normalizarLista([nombre]);
    if (!nombresNorm.length) continue;
    const nombreNorm = nombresNorm[0];
    if (vistos.has(nombreNorm)) continue;
    vistos.add(nombreNorm);
    salida.push({ nombre: nombreNorm, cantidad, unidad });
  }
  return salida;
}

function normalizarPasos(pasos) {
  return (pasos || []).map((p) => {
    if (typeof p === 'string') return { texto: p, tiempo_minutos: null };
    return { texto: p.texto || '', tiempo_minutos: p.tiempo_minutos ?? null };
  });
}

export async function crear(receta) {
  const datos = {
    nombre: receta.nombre,
    dificultad: receta.dificultad || 'facil',
    tiempo_minutos: receta.tiempo_minutos,
    porciones: receta.porciones || 2,
    tipo: receta.tipo || null,
    pasos: normalizarPasos(receta.pasos),
    origen: receta.origen || 'usuario',
    ingredientes_esenciales: normalizarIngredientes(receta.ingredientes_esenciales),
    ingredientes_opcionales: normalizarIngredientes(receta.ingredientes_opcionales),
  };

  const todas = await obtenerTodas();
  const existente = todas.find((r) => r.nombre.toLowerCase() === datos.nombre.toLowerCase());
  if (existente) return existente;

  const store = await tx('readwrite');
  const id = await promiseRequest(store.add(datos));
  return { ...datos, id };
}

export async function borrar(id) {
  const store = await tx('readwrite');
  await promiseRequest(store.delete(Number(id)));
  return { ok: true, id: Number(id) };
}

export async function listarIngredientesConocidos() {
  const todas = await obtenerTodas();
  const set = new Set();
  for (const r of todas) {
    for (const i of r.ingredientes_esenciales || []) set.add(i.nombre);
    for (const i of r.ingredientes_opcionales || []) set.add(i.nombre);
  }
  return Array.from(set).sort();
}
