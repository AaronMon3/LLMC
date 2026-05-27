<script>
  import { navigate } from '../router.js';
  import { api } from '../lib/api.js';
  import {
    despensa, restricciones, porcionesObjetivo,
    historialBusquedas, busquedasGuardadas, agregarBusquedaHistorial,
  } from '../stores.js';
  import ChipsInput from '../components/ChipsInput.svelte';

  const COMUNES = ['pollo', 'huevo', 'papa', 'arroz', 'cebolla', 'ajo', 'tomate', 'fideos', 'queso'];

  let ingredientes = $state([]);
  let tiempoMax = $state('');
  let dificultad = $state('');
  let tipoComida = $state('');
  let modoEstricto = $state(false);
  let porciones = $state(2);

  let ingredientesConocidos = $state([]);

  let despensaActual = $state([]);
  let restriccionesActuales = $state([]);
  let listaHistorial = $state([]);
  let listaGuardadas = $state([]);

  let despensaAbierta = $state(false);

  $effect(() => {
    const u = despensa.subscribe((v) => despensaActual = v);
    return u;
  });
  $effect(() => {
    const u = restricciones.subscribe((v) => restriccionesActuales = v);
    return u;
  });
  $effect(() => {
    const u = porcionesObjetivo.subscribe((v) => porciones = v);
    return u;
  });
  $effect(() => {
    const u = historialBusquedas.subscribe((v) => listaHistorial = v);
    return u;
  });
  $effect(() => {
    const u = busquedasGuardadas.subscribe((v) => listaGuardadas = v);
    return u;
  });

  $effect(() => {
    api.listarIngredientes().then((r) => { ingredientesConocidos = r; }).catch(() => {});
  });

  let ingredientesEfectivos = $derived.by(() => {
    const set = new Set(ingredientes.map((s) => s.toLowerCase()));
    for (const d of despensaActual) set.add(d.toLowerCase());
    return Array.from(set);
  });

  function buscar() {
    if (ingredientes.length === 0) return;
    porcionesObjetivo.set(porciones);
    agregarBusquedaHistorial(ingredientes);

    const params = new URLSearchParams();
    params.set('q', ingredientes.join(', '));
    if (despensaActual.length > 0) params.set('despensa', despensaActual.join(','));
    if (restriccionesActuales.length > 0) params.set('excluir', restriccionesActuales.join(','));
    if (tiempoMax) params.set('tiempo_max', tiempoMax);
    if (dificultad) params.set('dificultad', dificultad);
    if (tipoComida) params.set('tipo', tipoComida);
    if (modoEstricto) params.set('estricto', '1');
    params.set('porciones', String(porciones));

    navigate(`/results?${params.toString()}`);
  }

  function cargarBusqueda(items) {
    ingredientes = [...items];
  }

  function guardarBusqueda() {
    if (ingredientes.length === 0) return;
    const nombre = prompt('Nombre para esta búsqueda:', ingredientes.slice(0, 3).join(', '));
    if (!nombre) return;
    busquedasGuardadas.update((lista) => [
      ...lista.filter((b) => b.nombre !== nombre),
      { nombre, ingredientes: [...ingredientes] },
    ]);
  }

  function borrarBusquedaGuardada(nombre) {
    busquedasGuardadas.update((lista) => lista.filter((b) => b.nombre !== nombre));
  }
</script>

<div class="card">
  <h1>¿Qué hay en la cocina hoy?</h1>
  <p class="muted">Agregá los ingredientes que tenés. Reconocemos sinónimos.</p>

  <hr class="divider" />

  <ChipsInput
    bind:valores={ingredientes}
    sugerencias={ingredientesConocidos}
    placeholder="empezá a tipear: pollo, arroz…"
    onbuscar={buscar}
  />

  <div style="margin-top: 10px;">
    <div class="small muted" style="margin-bottom: 6px; font-style: normal;">
      o agregá algunos comunes:
    </div>
    <div class="row" style="gap: 6px; flex-wrap: wrap;">
      {#each COMUNES as c}
        {#if !ingredientes.includes(c)}
          <button class="btn-ghost btn"
                  style="width: auto; padding: 4px 10px; font-size: 12px; text-transform: none;"
                  onclick={() => ingredientes = [...ingredientes, c]}>
            + {c}
          </button>
        {/if}
      {/each}
    </div>
  </div>

  {#if despensaActual.length > 0}
    <p class="small muted" style="margin-top: 12px; font-style: normal;">
      + tu despensa fija: <strong style="color: var(--ink);">{despensaActual.join(', ')}</strong>
    </p>
  {/if}

  {#if ingredientes.length > 0}
    <div class="small" style="margin-top: 12px; padding: 8px 12px; background: var(--paper); border-radius: 2px; border: 1px solid var(--paper-edge);">
      <span class="muted" style="font-style: normal;">Voy a buscar con</span>
      <strong>{ingredientesEfectivos.length}</strong>
      <span class="muted" style="font-style: normal;">{ingredientesEfectivos.length === 1 ? 'ingrediente' : 'ingredientes'}</span>
    </div>
  {/if}

  <div class="col" style="margin-top: 16px;">
    <button class="btn btn-primary" onclick={buscar} disabled={ingredientes.length === 0}>
      Buscar recetas
    </button>

    {#if ingredientes.length > 0}
      <button class="btn btn-ghost" onclick={guardarBusqueda}>
        Guardar esta búsqueda
      </button>
    {/if}

    <button class="btn btn-ghost" onclick={() => navigate('/all')}>
      Ver todo el recetario →
    </button>
  </div>
</div>

<div class="card">
  <details>
    <summary>
      <strong style="color: var(--ink);">Filtros y opciones</strong>
    </summary>
    <div class="col" style="margin-top: 14px; gap: 14px;">
      <div>
        <label class="small">Cocinar para</label>
        <div class="row" style="gap: 8px; align-items: center;">
          <button class="icon-btn" onclick={() => porciones = Math.max(1, porciones - 1)}
                  style="font-size: 22px; padding: 4px 12px;">−</button>
          <span style="font-family: 'Caveat', cursive; font-size: 26px; color: var(--primary); font-weight: 700; min-width: 30px; text-align: center;">
            {porciones}
          </span>
          <button class="icon-btn" onclick={() => porciones = Math.min(30, porciones + 1)}
                  style="font-size: 22px; padding: 4px 12px;">+</button>
          <span class="small muted" style="font-style: normal;">{porciones === 1 ? 'persona' : 'personas'}</span>
        </div>
      </div>

      <div>
        <label class="small">Tipo de comida</label>
        <div class="row" style="gap: 6px; flex-wrap: wrap;">
          <button class="btn-ghost btn"
                  style="width: auto; padding: 6px 12px; font-size: 12px; text-transform: none;
                         {tipoComida === '' ? 'background: var(--ink); color: var(--paper-2);' : ''}"
                  onclick={() => tipoComida = ''}>
            cualquiera
          </button>
          {#each ['desayuno', 'almuerzo', 'cena', 'merienda', 'postres', 'guarnicion'] as t}
            <button class="btn-ghost btn"
                    style="width: auto; padding: 6px 12px; font-size: 12px; text-transform: none;
                           {tipoComida === t ? 'background: var(--ink); color: var(--paper-2);' : ''}"
                    onclick={() => tipoComida = tipoComida === t ? '' : t}>
              {t}
            </button>
          {/each}
        </div>
      </div>

      <div class="row" style="gap: 12px;">
        <div style="flex: 1;">
          <label class="small">Tiempo máx (min)</label>
          <input class="input" type="number" min="5" max="180" placeholder="sin límite" bind:value={tiempoMax} />
        </div>
        <div style="flex: 1;">
          <label class="small">Dificultad</label>
          <select class="input" bind:value={dificultad}>
            <option value="">cualquiera</option>
            <option value="facil">fácil</option>
            <option value="media">media</option>
          </select>
        </div>
      </div>

      <label class="row" style="cursor: pointer; padding: 8px 0; gap: 10px;">
        <input type="checkbox" bind:checked={modoEstricto} style="margin: 0;" />
        <div style="flex: 1;">
          <div class="small" style="font-style: normal; color: var(--ink);">Modo estricto</div>
          <div class="small muted">Solo recetas con TODOS los ingredientes que tenés</div>
        </div>
      </label>
    </div>
  </details>
</div>

<div class="card">
  <button onclick={() => despensaAbierta = !despensaAbierta}
          style="width: 100%; background: transparent; border: none; cursor: pointer; padding: 0; text-align: left;">
    <div class="row" style="gap: 10px;">
      <h3 style="margin: 0; flex: 1; font-family: 'Caveat', cursive; font-size: 24px; color: var(--primary);">
        Tu despensa fija
      </h3>
      <span class="small muted" style="font-style: normal;">{despensaActual.length} {despensaActual.length === 1 ? 'item' : 'items'}</span>
      <span style="font-size: 18px; color: var(--ink-soft);">{despensaAbierta ? '▴' : '▾'}</span>
    </div>
  </button>

  {#if despensaAbierta}
    <p class="small muted" style="margin: 10px 0;">
      Ingredientes que siempre tenés. Se suman automáticamente a cada búsqueda.
    </p>
    <ChipsInput
      bind:valores={despensaActual}
      sugerencias={ingredientesConocidos}
      placeholder="agregá: aceite, sal, ajo…"
    />
    <button class="btn btn-ghost" style="margin-top: 10px;" onclick={() => despensa.set(despensaActual)}>
      Guardar despensa
    </button>
  {/if}
</div>

<div class="card">
  <h3 style="font-family: 'Caveat', cursive; font-size: 24px; color: var(--primary); margin-bottom: 6px;">
    Restricciones
  </h3>
  <p class="small muted" style="margin: 0 0 10px;">
    Ingredientes que no querés en las recetas (alergias, lo que no comés).
  </p>
  <ChipsInput
    bind:valores={restriccionesActuales}
    sugerencias={ingredientesConocidos}
    placeholder="ej: gluten, mani, lactosa…"
  />
  <button class="btn btn-ghost" style="margin-top: 10px;" onclick={() => restricciones.set(restriccionesActuales)}>
    Guardar restricciones
  </button>
</div>

{#if listaHistorial.length > 0}
  <div class="card">
    <h3 style="font-family: 'Caveat', cursive; font-size: 24px; color: var(--primary); margin-bottom: 8px;">
      Búsquedas recientes
    </h3>
    <div class="row" style="gap: 6px; flex-wrap: wrap;">
      {#each listaHistorial as h}
        <button class="btn-ghost btn"
                style="width: auto; padding: 6px 12px; font-size: 12px; text-transform: none;"
                onclick={() => cargarBusqueda(h.ingredientes)}>
          {h.ingredientes.slice(0, 4).join(', ')}{h.ingredientes.length > 4 ? '…' : ''}
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if listaGuardadas.length > 0}
  <div class="card">
    <h3 style="font-family: 'Caveat', cursive; font-size: 24px; color: var(--primary); margin-bottom: 8px;">
      Búsquedas guardadas
    </h3>
    <div class="col" style="gap: 6px;">
      {#each listaGuardadas as g}
        <div class="row" style="gap: 8px;">
          <button class="btn-ghost btn"
                  style="flex: 1; padding: 8px 12px; font-size: 13px; text-transform: none; text-align: left;"
                  onclick={() => cargarBusqueda(g.ingredientes)}>
            <strong style="color: var(--ink);">{g.nombre}</strong>
            <span class="muted small" style="font-style: normal;"> — {g.ingredientes.join(', ')}</span>
          </button>
          <button class="icon-btn" onclick={() => borrarBusquedaGuardada(g.nombre)} title="Borrar">×</button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<div class="card">
  <h3 style="font-family: 'Caveat', cursive; font-size: 22px; color: var(--primary); margin-bottom: 4px;">
    Notita
  </h3>
  <p class="small" style="margin: 0; font-style: italic;">
    Tab o Enter agrega un chip · Backspace borra el último · Ctrl+Enter busca.
  </p>
</div>
