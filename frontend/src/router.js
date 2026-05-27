import { writable } from 'svelte/store';

function parsearHash() {
  const raw = window.location.hash.slice(1) || '/';
  const [pathConQuery] = [raw];
  const [path, queryStr = ''] = pathConQuery.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryStr));
  return { path, query };
}

export const ruta = writable(parsearHash());

window.addEventListener('hashchange', () => {
  ruta.set(parsearHash());
  window.scrollTo(0, 0);
});

export function navigate(destino) {
  if (destino.startsWith('#')) destino = destino.slice(1);
  window.location.hash = destino;
}

export function volver(fallback = '/') {
  if (window.history.length > 1) {
    const antes = window.location.hash;
    window.history.back();
    setTimeout(() => {
      if (window.location.hash === antes) navigate(fallback);
    }, 80);
  } else {
    navigate(fallback);
  }
}

export function matchRoute(pattern, path) {
  const partesPattern = pattern.split('/').filter(Boolean);
  const partesPath = path.split('/').filter(Boolean);
  if (partesPattern.length !== partesPath.length) return null;
  const params = {};
  for (let i = 0; i < partesPattern.length; i++) {
    const pp = partesPattern[i];
    const px = partesPath[i];
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(px);
    } else if (pp !== px) {
      return null;
    }
  }
  return params;
}
