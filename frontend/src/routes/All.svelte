<script>
  import { navigate, volver } from '../router.js';
  import { api } from '../lib/api.js';

  let recetas = $state([]);
  let cargando = $state(true);
  let error = $state('');
  let filtroNombre = $state('');
  let filtroTipo = $state('');

  $effect(() => {
    cargar();
  });

  async function cargar() {
    cargando = true;
    error = '';
    try {
      recetas = await api.listarRecetas({});
    } catch (e) {
      error = e.message;
    } finally {
      cargando = false;
    }
  }

  let recetasFiltradas = $derived.by(() => {
    const q = filtroNombre.trim().toLowerCase();
    return recetas.filter((r) => {
      if (filtroTipo && r.tipo !== filtroTipo) return false;
      if (q && !r.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  let agrupado = $derived.by(() => {
    const m = new Map();
    for (const r of recetasFiltradas) {
      const t = r.tipo || 'otros';
      if (!m.has(t)) m.set(t, []);
      m.get(t).push(r);
    }
    const orden = ['desayuno', 'almuerzo', 'cena', 'merienda', 'postres', 'guarnicion', 'otros'];
    return orden.filter((t) => m.has(t)).map((t) => [t, m.get(t)]);
  });
</script>

<div class="row" style="margin-bottom: 16px;">
  <button class="icon-btn" onclick={() => volver('/')}>←</button>
  <h2 style="margin: 0;">El recetario completo</h2>
</div>

<div class="card">
  <div class="col" style="gap: 10px;">
    <input class="input" placeholder="buscar por nombre…" bind:value={filtroNombre} />
    <div class="row" style="gap: 6px; flex-wrap: wrap;">
      <button class="btn-ghost btn" style="width: auto; padding: 6px 12px; font-size: 12px;"
              onclick={() => filtroTipo = ''}
              style:background={filtroTipo === '' ? 'var(--ink)' : 'transparent'}
              style:color={filtroTipo === '' ? 'var(--paper-2)' : 'var(--ink-soft)'}>
        todos
      </button>
      {#each ['desayuno', 'almuerzo', 'cena', 'merienda', 'postres', 'guarnicion'] as tipo}
        <button class="btn-ghost btn" style="width: auto; padding: 6px 12px; font-size: 12px;"
                onclick={() => filtroTipo = filtroTipo === tipo ? '' : tipo}
                style:background={filtroTipo === tipo ? 'var(--ink)' : 'transparent'}
                style:color={filtroTipo === tipo ? 'var(--paper-2)' : 'var(--ink-soft)'}>
          {tipo}
        </button>
      {/each}
    </div>
  </div>
</div>

{#if cargando}
  <div class="card"><p class="muted small" style="margin: 0;">Cargando…</p></div>
{:else if error}
  <div class="card"><p style="color: var(--danger);">{error}</p></div>
{:else if recetasFiltradas.length === 0}
  <div class="card"><p class="muted small" style="margin: 0;">No hay recetas que coincidan con el filtro.</p></div>
{:else}
  <p class="muted small">{recetasFiltradas.length} {recetasFiltradas.length === 1 ? 'receta' : 'recetas'}</p>

  {#each agrupado as [tipo, lista]}
    <h3 style="font-family: 'Caveat', cursive; font-size: 24px; color: var(--primary); margin: 18px 0 8px; text-transform: capitalize;">
      {tipo}
    </h3>
    <div class="card" style="padding: 6px 18px;">
      {#each lista as r, i}
        <button class="recipe-card"
                style="display: block; width: 100%; text-align: left; padding: 12px 0;
                       cursor: pointer; background: transparent;
                       border: none; {i < lista.length - 1 ? 'border-bottom: 1px dashed var(--paper-edge);' : ''}
                       font: inherit; color: inherit;"
                onclick={() => navigate(`/recipe/${r.id}`)}>
          <div class="row" style="gap: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 17px;">{r.nombre}</div>
              <div class="small muted" style="font-style: normal;">
                {r.tiempo_minutos} min · {r.dificultad} · rinde {r.porciones}
              </div>
            </div>
            {#if r.origen === 'ia'}<span class="tag tag-blue">IA</span>{/if}
            {#if r.origen === 'usuario'}<span class="tag tag-blue">cargada</span>{/if}
          </div>
        </button>
      {/each}
    </div>
  {/each}
{/if}
