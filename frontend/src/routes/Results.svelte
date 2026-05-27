<script>
  import { navigate, volver } from '../router.js';
  import { api } from '../lib/api.js';
  import { llmConfig, getKeyActiva, PROVIDERS } from '../stores.js';

  let { query = {} } = $props();

  let resultados = $state([]);
  let total = $state(0);
  let cargando = $state(true);
  let error = $state('');
  let consulta = $derived(query.q || '');

  let config = $state({ provider: 'groq', keys: {} });
  let claveActual = $derived(getKeyActiva(config));
  let proveedorActivo = $derived(PROVIDERS[config.provider]?.nombre || 'IA');
  $effect(() => {
    const unsub = llmConfig.subscribe((c) => { config = c; });
    return unsub;
  });

  let sugerencias = $state([]);
  let sugiriendo = $state(false);
  let errorSugerir = $state('');
  let guardandoIdx = $state(-1);
  let guardadasIds = $state(new Set());

  $effect(() => {
    if (!consulta.trim()) {
      navigate('/');
      return;
    }
    cargar();
  });

  function parseIngredientes(texto) {
    return texto.split(/[,\n;]| y | con /i).map((s) => s.trim()).filter(Boolean);
  }

  let modoAprovechar = $derived(query.aprovechar === '1');

  function obtenerFiltros() {
    const filtros = {};
    if (query.tiempo_max) filtros.tiempo_max = Number(query.tiempo_max);
    if (query.dificultad) filtros.dificultad = query.dificultad;
    if (query.tipo) filtros.tipo = query.tipo;
    if (query.estricto === '1') {
      filtros.incluir_faltantes = false;
      filtros.min_match = 1;
    }
    if (query.aprovechar === '1') {
      filtros.modo_aprovechar = true;
    }
    if (query.excluir) {
      filtros.excluir = query.excluir.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return filtros;
  }

  function obtenerIngredientes() {
    const lista = parseIngredientes(consulta);
    if (query.despensa) {
      const despensa = query.despensa.split(',').map((s) => s.trim()).filter(Boolean);
      const set = new Set(lista.map((s) => s.toLowerCase()));
      for (const d of despensa) {
        if (!set.has(d.toLowerCase())) lista.push(d);
      }
    }
    return lista;
  }

  async function cargar() {
    cargando = true;
    error = '';
    sugerencias = [];
    errorSugerir = '';
    guardadasIds = new Set();
    try {
      const data = await api.buscar(obtenerIngredientes(), obtenerFiltros());
      resultados = data.resultados;
      total = data.total;
    } catch (e) {
      error = e.message;
    } finally {
      cargando = false;
    }
  }

  async function generarMas() {
    if (!claveActual) {
      errorSugerir = `Necesitás configurar la API key de ${proveedorActivo} en ajustes.`;
      return;
    }
    sugiriendo = true;
    errorSugerir = '';
    try {
      const ingredientes = obtenerIngredientes();
      const excluir = [
        ...resultados.map((r) => r.receta.nombre),
        ...sugerencias.map((s) => s.nombre),
      ];
      const data = await api.sugerirRecetas(ingredientes, excluir, config.provider, claveActual, modoAprovechar);

      const nuevasNoRepetidas = data.recetas.filter(
        (nueva) => !sugerencias.some((existente) =>
          existente.nombre.toLowerCase() === nueva.nombre.toLowerCase()
        )
      );

      if (nuevasNoRepetidas.length === 0) {
        errorSugerir = 'La IA repitió las recetas anteriores. Probá de nuevo en unos segundos o cambiá los ingredientes.';
      } else {
        sugerencias = [...sugerencias, ...nuevasNoRepetidas];
        const elemento = document.getElementById('sugerencias-ia');
        if (elemento) elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      errorSugerir = e.message;
    } finally {
      sugiriendo = false;
    }
  }

  async function guardarSugerencia(idx) {
    guardandoIdx = idx;
    try {
      await api.crearReceta({ ...sugerencias[idx], origen: 'ia' });
      guardadasIds = new Set([...guardadasIds, idx]);
      await refrescar();
    } catch (e) {
      alert('Error guardando: ' + e.message);
    } finally {
      guardandoIdx = -1;
    }
  }

  async function refrescar() {
    try {
      const data = await api.buscar(obtenerIngredientes(), obtenerFiltros());
      resultados = data.resultados;
      total = data.total;
    } catch {}
  }
</script>

<div class="row" style="margin-bottom: 16px;">
  <button class="icon-btn" onclick={() => volver('/')}>←</button>
  <div>
    <div class="small muted">Buscando con</div>
    <div style="font-weight: 600; font-family: 'Caveat', cursive; font-size: 22px; color: var(--primary);">
      {consulta}
    </div>
  </div>
</div>

{#if !cargando && !error}
  <div class="card" style="border: 1px dashed var(--primary); background: var(--paper-2); padding: 14px 18px;">
    {#if modoAprovechar}
      <div class="small" style="margin-bottom: 8px; padding: 6px 10px; background: var(--olive-soft); color: var(--olive); border-radius: 2px;">
        🌱 Modo aprovechar activo · ordenado por uso de tus ingredientes
      </div>
    {/if}
    <div class="row" style="gap: 10px; align-items: center;">
      <div style="flex: 1;">
        <div style="font-family: 'Caveat', cursive; font-size: 22px; color: var(--primary); line-height: 1;">
          ¿Querés más opciones?
        </div>
        <div class="small muted" style="margin-top: 2px;">
          {proveedorActivo} te sugiere 3 recetas{modoAprovechar ? ' que usen muchos de tus ingredientes' : ' nuevas'}.
        </div>
      </div>
      <button class="btn btn-primary" style="width: auto; padding: 10px 18px; font-size: 12px;"
              onclick={generarMas} disabled={sugiriendo}>
        {sugiriendo ? 'Pensando…' : 'Generar →'}
      </button>
    </div>
    {#if errorSugerir}
      <p style="color: var(--danger); margin: 8px 0 0;" class="small">{errorSugerir}</p>
    {/if}
    {#if !claveActual}
      <p class="muted small" style="margin: 8px 0 0;">
        Configurá tu API key en <a href="#/settings">ajustes</a>.
      </p>
    {/if}
  </div>
{/if}

{#if cargando}
  <div class="card"><p class="muted" style="margin: 0;">Hojeando el recetario…</p></div>
{:else if error}
  <div class="card"><p style="color: var(--danger); margin: 0;">{error}</p></div>
{:else}
  {#if sugerencias.length > 0}
    <h3 id="sugerencias-ia" style="margin-top: 22px; font-family: 'Caveat', cursive; font-size: 28px; color: var(--primary);">
      Sugerencias de la IA
    </h3>
    {#each sugerencias as s, i (s.nombre)}
      <div class="card" style="border-left: 3px solid var(--primary);">
        <div class="row" style="margin-bottom: 8px;">
          <h3 class="nombre" style="margin: 0; flex: 1;">{s.nombre}</h3>
          <span class="tag tag-blue">IA</span>
        </div>
        <div class="row" style="gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
          <span class="tag">{s.tiempo_minutos} min</span>
          <span class="tag">{s.porciones} porc.</span>
          <span class="tag">{s.dificultad}</span>
          {#if s.tipo}<span class="tag">{s.tipo}</span>{/if}
        </div>
        <div class="small" style="margin-bottom: 10px; line-height: 1.55;">
          <em style="color: var(--ink-soft);">Ingredientes —</em>
          {s.ingredientes_esenciales.map((it) => typeof it === 'string' ? it : it.nombre).join(', ')}{#if s.ingredientes_opcionales.length}, <em style="color: var(--ink-soft);">{s.ingredientes_opcionales.map((it) => typeof it === 'string' ? it : it.nombre).join(', ')} (opcional)</em>{/if}
        </div>
        <details>
          <summary>ver los pasos</summary>
          <ol class="recipe-list" style="margin: 10px 0 0;">
            {#each s.pasos as p}<li>{typeof p === 'string' ? p : p.texto}</li>{/each}
          </ol>
        </details>

        {#if guardadasIds.has(i)}
          <p class="small" style="color: var(--olive); margin: 14px 0 0; font-style: italic;">
            ✓ Guardada en el cuaderno
          </p>
        {:else}
          <button class="btn btn-secondary" style="margin-top: 14px;"
                  onclick={() => guardarSugerencia(i)}
                  disabled={guardandoIdx === i}>
            {guardandoIdx === i ? 'Guardando…' : 'Guardar en el cuaderno'}
          </button>
        {/if}
      </div>
    {/each}

    <hr class="divider" />
  {/if}

  {#if total === 0 && sugerencias.length === 0}
    <div class="card">
      <h3>Nada en el recetario con eso</h3>
      <p class="muted small">Probá pedirle a la IA que sugiera algo con el botón de arriba.</p>
    </div>
  {:else if total > 0}
    <p class="muted small">
      Del recetario · {total} {total === 1 ? 'receta' : 'recetas'}
    </p>
    {#each resultados as r (r.receta.id)}
      <button class="card recipe-card" onclick={() => navigate(`/recipe/${r.receta.id}`)}
              style="width: 100%; text-align: left; cursor: pointer; font: inherit; color: inherit; background: var(--paper-2);">
        <div class="row" style="margin-bottom: 8px; gap: 10px;">
          <h3 class="nombre" style="margin: 0; flex: 1;">{r.receta.nombre}</h3>
          {#if r.receta.origen === 'ia'}<span class="tag tag-blue">IA</span>{/if}
          {#if r.receta.origen === 'usuario'}<span class="tag tag-blue">cargada</span>{/if}
          {#if modoAprovechar}
            <span class="tag tag-green" title="ingredientes tuyos que usa">
              usa {r.ingredientes_aprovechados.length}/{r.total_ingredientes_usuario}
            </span>
          {:else}
            <span class="tag tag-green">{Math.round(r.porcentaje_match * 100)}%</span>
          {/if}
        </div>
        <div class="row" style="gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
          <span class="tag">{r.receta.tiempo_minutos} min</span>
          <span class="tag">{r.receta.porciones} porc.</span>
          <span class="tag">{r.receta.dificultad}</span>
          {#if r.receta.tipo}<span class="tag">{r.receta.tipo}</span>{/if}
        </div>
        {#if r.ingredientes_faltantes.length > 0}
          <p class="small" style="margin: 4px 0 0; font-style: italic; color: var(--ink-soft);">
            Te falta: <strong style="font-style: normal; color: var(--ink);">{r.ingredientes_faltantes.join(', ')}</strong>
          </p>
        {:else}
          <p class="small" style="margin: 4px 0 0; color: var(--olive); font-style: italic;">
            ✓ Tenés todos los ingredientes
          </p>
        {/if}
      </button>
    {/each}
  {/if}
{/if}
