/**
 * Formato y escalado de cantidades de ingredientes.
 */

const UNIDAD_PLURAL = {
  unidad: 'unidades',
  cda: 'cdas',
  cdita: 'cditas',
  taza: 'tazas',
  diente: 'dientes',
};

const UNIDADES_PLURALIZAR = new Set(Object.keys(UNIDAD_PLURAL));

export function escalarCantidad(cantidad, porcionesOrig, porcionesNuevas) {
  if (!cantidad || cantidad === 0) return 0;
  if (!porcionesOrig || porcionesOrig === porcionesNuevas) return cantidad;
  return (cantidad * porcionesNuevas) / porcionesOrig;
}

function formatearNumero(n) {
  if (n === 0) return '';
  const redondeado = Math.round(n * 10) / 10;
  if (Number.isInteger(redondeado)) return String(redondeado);
  return redondeado.toFixed(1).replace(/\.0$/, '');
}

export function formatearIngrediente(ing, porcionesOrig, porcionesNuevas) {
  if (!ing) return '';
  const nombre = ing.nombre;
  const unidad = ing.unidad || 'al gusto';

  if (unidad === 'al gusto' || !ing.cantidad) {
    return `${nombre} (a gusto)`;
  }

  const cantidad = escalarCantidad(ing.cantidad, porcionesOrig, porcionesNuevas);
  const num = formatearNumero(cantidad);

  let unidadStr = unidad;
  if (UNIDADES_PLURALIZAR.has(unidad) && cantidad !== 1) {
    unidadStr = UNIDAD_PLURAL[unidad];
  }

  if (unidad === 'unidad' || unidad === 'unidades') {
    return `${num} ${nombre}${cantidad !== 1 ? (nombre.endsWith('s') ? '' : 's') : ''}`;
  }

  return `${num} ${unidadStr} de ${nombre}`;
}

export function formatearTiempoPaso(tm) {
  if (!tm || tm <= 0) return '';
  if (tm < 60) return `${tm} min`;
  const h = Math.floor(tm / 60);
  const m = tm % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function extraerSenales(texto) {
  const senales = [];
  const grados = texto.match(/(\d{2,3})\s*grados?/i);
  if (grados) senales.push(`${grados[1]}°`);
  if (/fuego\s*alto|bien\s*caliente/i.test(texto)) senales.push('🔥 alto');
  else if (/fuego\s*medio/i.test(texto)) senales.push('🔥 medio');
  else if (/fuego\s*bajo|fuego\s*minimo/i.test(texto)) senales.push('🔥 bajo');
  return senales;
}
