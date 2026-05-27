<script>
  import { navigate, volver } from '../router.js';
  import { api } from '../lib/api.js';
  import { favoritos, historial } from '../stores.js';

  let recetasFav = $state([]);
  let cargando = $state(true);
  let listaHistorial = $state([]);

  $effect(() => {
    const unsub = favoritos.subscribe(async (ids) => {
      cargando = true;
      try {
        const resultados = await Promise.all(ids.map((id) => api.obtenerReceta(id).catch(() => null)));
        recetasFav = resultados.filter(Boolean);
      } finally {
        cargando = false;
      }
    });
    return unsub;
  });

  $effect(() => {
    const unsub = historial.subscribe((h) => { listaHistorial = h; });
    return unsub;
  });
</script>

<div class="row" style="margin-bottom: 16px;">
  <button class="icon-btn" onclick={() => volver('/')}>←</button>
  <h2 style="margin: 0;">El recetario</h2>
</div>

<div class="card">
  <h3 style="font-family: 'Caveat', cursive; font-size: 26px; color: var(--primary);">
    ★ Favoritas
  </h3>
  <hr class="divider" />
  {#if cargando}
    <p class="muted small">Buscando…</p>
  {:else if recetasFav.length === 0}
    <p class="muted small" style="margin: 0;">
      Marcá una receta como favorita desde su pantalla para verla acá.
    </p>
  {:else}
    {#each recetasFav as r}
      <button class="recipe-card"
              style="display: block; width: 100%; text-align: left; padding: 12px 14px;
                     border-radius: 2px; cursor: pointer; background: transparent;
                     border: none; border-bottom: 1px dashed var(--paper-edge);
                     font: inherit; color: inherit;"
              onclick={() => navigate(`/recipe/${r.id}`)}>
        <div style="font-weight: 600; font-size: 17px;">{r.nombre}</div>
        <div class="small muted">{r.tiempo_minutos} min · {r.dificultad}</div>
      </button>
    {/each}
  {/if}
</div>

<div class="card">
  <h3 style="font-family: 'Caveat', cursive; font-size: 26px; color: var(--primary);">
    Últimas que viste
  </h3>
  <hr class="divider" />
  {#if listaHistorial.length === 0}
    <p class="muted small" style="margin: 0;">Las recetas que abras aparecerán acá.</p>
  {:else}
    {#each listaHistorial as h}
      <button style="display: block; width: 100%; text-align: left; padding: 10px 0;
                     border: none; border-bottom: 1px dashed var(--paper-edge);
                     background: transparent; cursor: pointer; font: inherit; color: inherit;"
              onclick={() => navigate(`/recipe/${h.id}`)}>
        <div style="font-weight: 500; font-size: 16px;">{h.nombre}</div>
        <div class="small muted">{new Date(h.fecha).toLocaleDateString()}</div>
      </button>
    {/each}
  {/if}
</div>
