const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Error ${res.status}: ${detalle}`);
  }
  return res.json();
}

export const api = {
  buscar(ingredientes, filtros = {}) {
    return request('/recipes/search', {
      method: 'POST',
      body: JSON.stringify({ ingredientes, ...filtros }),
    });
  },

  obtenerReceta(id) {
    return request(`/recipes/${id}`);
  },

  listarIngredientes() {
    return request('/ingredients');
  },

  listarRecetas(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    const qs = params.toString();
    return request('/recipes' + (qs ? '?' + qs : ''));
  },

  crearReceta(receta) {
    return request('/recipes', {
      method: 'POST',
      body: JSON.stringify(receta),
    });
  },

  borrarReceta(id) {
    return request(`/recipes/${id}`, { method: 'DELETE' });
  },

  parsearReceta(texto, provider, apiKey) {
    return request('/recipes/parse', {
      method: 'POST',
      body: JSON.stringify({ texto, provider, api_key: apiKey }),
    });
  },

  sugerirRecetas(ingredientes, excluir, provider, apiKey, modoAprovechar = false) {
    return request('/recipes/suggest', {
      method: 'POST',
      body: JSON.stringify({ ingredientes, excluir, provider, api_key: apiKey, modo_aprovechar: modoAprovechar }),
    });
  },
};
