<script>
  import { navigate, volver } from '../router.js';
  import { api } from '../lib/api.js';
  import { preguntarAlChef } from '../lib/llm.js';
  import { llmConfig, getKeyActiva, favoritos, toggleFavorito, agregarAlHistorial, PROVIDERS, porcionesObjetivo, historial, despensa, agregarALista } from '../stores.js';
  import { get } from 'svelte/store';
  import { formatearIngrediente, formatearTiempoPaso, extraerSenales } from '../lib/format.js';

  let { id } = $props();

  let receta = $state(null);
  let cargando = $state(true);
  let error = $state('');
  let pasoActual = $state(0);
  let porcionesElegidas = $state(2);

  let chatAbierto = $state(false);
  let pregunta = $state('');
  let conversacion = $state([]);
  let preguntando = $state(false);

  let agregadoCompras = $state(false);
  let despensaActual = $state([]);
  $effect(() => {
    const u = despensa.subscribe((v) => despensaActual = v);
    return u;
  });

  function agregarFaltantesACompras() {
    if (!receta) return;
    const tengo = new Set(despensaActual.map((s) => s.toLowerCase()));
    const items = receta.ingredientes_esenciales
      .filter((ing) => !tengo.has(ing.nombre.toLowerCase()))
      .map((ing) => ({
        nombre: ing.nombre,
        cantidad: (ing.cantidad * porcionesElegidas) / receta.porciones,
        unidad: ing.unidad,
      }));
    if (items.length === 0) {
      alert('Ya tenés todos los ingredientes en tu despensa.');
      return;
    }
    agregarALista(items);
    agregadoCompras = true;
    setTimeout(() => agregadoCompras = false, 2000);
  }

  let esFavorito = $state(false);
  let config = $state({ provider: 'groq', keys: {} });
  let claveActual = $derived(getKeyActiva(config));
  let proveedorActivo = $derived(PROVIDERS[config.provider]?.nombre || 'IA');

  $effect(() => {
    const unsub = favoritos.subscribe((lista) => {
      esFavorito = receta ? lista.includes(receta.id) : false;
    });
    return unsub;
  });
  $effect(() => {
    const unsub = llmConfig.subscribe((c) => { config = c; });
    return unsub;
  });

  $effect(() => {
    cargar(id);
  });

  async function cargar(rid) {
    cargando = true;
    error = '';
    pasoActual = 0;
    try {
      receta = await api.obtenerReceta(rid);
      porcionesElegidas = get(porcionesObjetivo) || receta.porciones;
      agregarAlHistorial(receta);
    } catch (e) {
      error = e.message;
    } finally {
      cargando = false;
    }
  }

  function siguientePaso() {
    if (pasoActual < receta.pasos.length - 1) pasoActual++;
  }
  function pasoAnterior() {
    if (pasoActual > 0) pasoActual--;
  }

  function ajustarPorciones(delta) {
    const nuevo = porcionesElegidas + delta;
    if (nuevo >= 1 && nuevo <= 30) porcionesElegidas = nuevo;
  }

  let borrando = $state(false);
  async function borrarReceta() {
    if (!receta) return;
    const ok = confirm(`¿Borrar "${receta.nombre}" del recetario?\n\nEsta accion no se puede deshacer.`);
    if (!ok) return;
    borrando = true;
    try {
      await api.borrarReceta(receta.id);
      favoritos.update((l) => l.filter((id) => id !== receta.id));
      historial.update((l) => l.filter((h) => h.id !== receta.id));
      navigate('/');
    } catch (e) {
      alert('Error: ' + e.message);
      borrando = false;
    }
  }

  async function enviarPregunta() {
    if (!pregunta.trim() || preguntando) return;
    const txt = pregunta;
    pregunta = '';
    conversacion = [...conversacion, { rol: 'user', texto: txt }];
    preguntando = true;
    try {
      const respuesta = await preguntarAlChef({
        provider: config.provider,
        apiKey: claveActual,
        receta,
        historial: conversacion.slice(0, -1),
        pregunta: txt,
      });
      conversacion = [...conversacion, { rol: 'assistant', texto: respuesta }];
    } catch (e) {
      conversacion = [...conversacion, { rol: 'assistant', texto: `⚠ ${e.message}` }];
    } finally {
      preguntando = false;
    }
  }
</script>

{#if cargando}
  <div class="card"><p class="muted" style="margin: 0;">Buscando la receta…</p></div>
{:else if error}
  <div class="card"><p style="color: var(--danger);">{error}</p></div>
{:else if receta}
  <div class="row" style="margin-bottom: 14px;">
    <button class="icon-btn" onclick={() => volver('/')}>←</button>
    <h2 style="margin: 0; flex: 1;">{receta.nombre}</h2>
    <button class="icon-btn" onclick={() => toggleFavorito(receta.id)} title="Favorito" style="font-size: 22px;">
      {esFavorito ? '★' : '☆'}
    </button>
  </div>

  <div class="card">
    <div class="row" style="gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
      <span class="tag">{receta.tiempo_minutos} min total</span>
      <span class="tag">{receta.dificultad}</span>
      {#if receta.tipo}<span class="tag">{receta.tipo}</span>{/if}
      {#if receta.origen === 'ia'}<span class="tag tag-blue">de la IA</span>{/if}
      {#if receta.origen === 'usuario'}<span class="tag tag-blue">cargada</span>{/if}
    </div>

    <div class="row" style="gap: 12px; align-items: center; padding: 12px 14px; background: var(--paper); border: 1px solid var(--paper-edge); border-radius: 2px;">
      <span class="small muted" style="font-style: normal;">Cocinar para</span>
      <button class="icon-btn" onclick={() => ajustarPorciones(-1)} disabled={porcionesElegidas <= 1}
              style="font-size: 22px; padding: 4px 12px;">−</button>
      <span style="font-family: 'Caveat', cursive; font-size: 32px; color: var(--primary); font-weight: 700; min-width: 36px; text-align: center;">
        {porcionesElegidas}
      </span>
      <button class="icon-btn" onclick={() => ajustarPorciones(1)} disabled={porcionesElegidas >= 30}
              style="font-size: 22px; padding: 4px 12px;">+</button>
      <span class="small muted" style="font-style: normal;">{porcionesElegidas === 1 ? 'persona' : 'personas'}</span>
      <div class="spacer"></div>
      {#if porcionesElegidas !== receta.porciones}
        <button class="btn-ghost btn" style="width: auto; padding: 4px 10px; font-size: 11px;"
                onclick={() => porcionesElegidas = receta.porciones}>
          original
        </button>
      {/if}
    </div>

    <hr class="divider" />

    <h3>Ingredientes</h3>
    <ul class="recipe-list">
      {#each receta.ingredientes_esenciales as ing}
        <li>{formatearIngrediente(ing, receta.porciones, porcionesElegidas)}</li>
      {/each}
      {#each receta.ingredientes_opcionales as ing}
        <li class="muted">
          {formatearIngrediente(ing, receta.porciones, porcionesElegidas)}
          <span class="small">(opcional)</span>
        </li>
      {/each}
    </ul>

    <button class="btn btn-ghost" style="margin-top: 14px;" onclick={agregarFaltantesACompras}>
      {agregadoCompras ? '✓ Agregado a la lista' : '+ a lista de compras'}
    </button>
  </div>

  <div class="card">
    <div class="row" style="margin-bottom: 14px; align-items: baseline; flex-wrap: wrap; gap: 6px;">
      <span class="step-num">Paso {pasoActual + 1}</span>
      <span class="muted">de {receta.pasos.length}</span>
      <div class="spacer"></div>
      {#each extraerSenales(receta.pasos[pasoActual].texto) as senal}
        <span class="tag tag-blue">{senal}</span>
      {/each}
      {#if receta.pasos[pasoActual].tiempo_minutos}
        <span class="tag">{formatearTiempoPaso(receta.pasos[pasoActual].tiempo_minutos)}</span>
      {/if}
    </div>

    <div class="step-box">
      {receta.pasos[pasoActual].texto}
    </div>

    <div class="row" style="margin-top: 16px; gap: 10px;">
      <button class="btn btn-ghost" onclick={pasoAnterior} disabled={pasoActual === 0}>← anterior</button>
      <button class="btn btn-primary" onclick={siguientePaso} disabled={pasoActual === receta.pasos.length - 1}>
        siguiente →
      </button>
    </div>
  </div>

  <div class="card" style="text-align: center;">
    <button class="btn btn-ghost"
            onclick={borrarReceta}
            disabled={borrando}
            style="color: var(--danger); border-color: transparent; max-width: 280px; margin: 0 auto;">
      {borrando ? 'Borrando…' : '✕ Borrar esta receta del cuaderno'}
    </button>
  </div>

  <button class="fab" onclick={() => chatAbierto = true} title="Preguntale al chef">💬</button>

  {#if chatAbierto}
    <div class="drawer-backdrop" onclick={() => chatAbierto = false}></div>
    <div class="drawer">
      <div class="drawer-handle"></div>
      <div class="row" style="margin-bottom: 8px;">
        <h3 style="margin: 0; flex: 1;">Pregunta al chef</h3>
        <span class="tag">{proveedorActivo}</span>
        <button class="icon-btn" onclick={() => chatAbierto = false} style="font-size: 22px;">×</button>
      </div>

      {#if !claveActual}
        <p class="muted small">
          Necesitás configurar la API key de <strong>{proveedorActivo}</strong> en
          <a href="#/settings">ajustes</a>.
        </p>
      {:else}
        <div class="drawer-body">
          {#if conversacion.length === 0}
            <p class="muted small" style="text-align: center; margin: 12px 0;">
              Hacele preguntas sobre esta receta — sustituciones, tiempos, técnicas.
            </p>
          {/if}
          {#each conversacion as m}
            <div style="padding: 10px 14px; border-radius: 2px;
                        background: {m.rol === 'user' ? 'var(--paper)' : 'transparent'};
                        border: 1px solid var(--paper-edge);
                        border-left: 3px solid {m.rol === 'user' ? 'var(--ink-soft)' : 'var(--primary)'};
                        max-width: 92%;
                        align-self: {m.rol === 'user' ? 'flex-end' : 'flex-start'};">
              {m.texto}
            </div>
          {/each}
          {#if preguntando}
            <div class="muted small" style="text-align: center;">Pensando…</div>
          {/if}
        </div>

        <div class="row" style="gap: 8px; margin-top: 12px;">
          <input class="input" placeholder="¿Puedo usar manteca en vez de aceite?"
                 bind:value={pregunta}
                 onkeydown={(e) => e.key === 'Enter' && enviarPregunta()} />
          <button class="btn btn-primary" style="width: auto; padding: 12px 18px;"
                  onclick={enviarPregunta} disabled={preguntando || !pregunta.trim()}>
            Enviar
          </button>
        </div>
      {/if}
    </div>
  {/if}
{/if}
