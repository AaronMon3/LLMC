<script>
  import { navigate, volver } from '../router.js';
  import { api } from '../lib/api.js';
  import { llmConfig, getKeyActiva, PROVIDERS } from '../stores.js';

  let config = $state({ provider: 'claude', keys: { claude: '', openai: '' } });
  let claveActual = $derived(getKeyActiva(config));
  let proveedorActivo = $derived(PROVIDERS[config.provider]?.nombre || 'IA');
  $effect(() => {
    const unsub = llmConfig.subscribe((c) => { config = c; });
    return unsub;
  });

  let texto = $state('');
  let parseando = $state(false);
  let error = $state('');
  let recetaExtraida = $state(null);
  let guardando = $state(false);

  const UNIDADES_VALIDAS = new Set([
    'g', 'kg', 'ml', 'l', 'unidad', 'unidades',
    'cda', 'cdas', 'cdita', 'cditas', 'taza', 'tazas',
    'diente', 'dientes', 'pizca',
  ]);

  function formatIng(i) {
    if (!i) return '';
    if (typeof i === 'string') return i;
    if (!i.cantidad || i.unidad === 'al gusto') return i.nombre;
    return `${i.cantidad} ${i.unidad} ${i.nombre}`;
  }

  function parsearIngs(texto) {
    return texto.split('\n').map((l) => l.trim()).filter(Boolean).map((linea) => {
      const partes = linea.split(/\s+/);
      if (partes.length >= 3 && /^\d+(\.\d+)?$/.test(partes[0]) && UNIDADES_VALIDAS.has(partes[1])) {
        return {
          cantidad: parseFloat(partes[0]),
          unidad: partes[1],
          nombre: partes.slice(2).join(' '),
        };
      }
      return { nombre: linea, cantidad: 0, unidad: 'al gusto' };
    });
  }

  function formatPaso(p) {
    if (!p) return '';
    if (typeof p === 'string') return p;
    const prefijo = p.tiempo_minutos ? `[${p.tiempo_minutos} min] ` : '';
    return prefijo + p.texto;
  }

  function parsearPasos(texto) {
    return texto.split('\n').map((l) => l.trim()).filter(Boolean).map((linea) => {
      const m = linea.match(/^\[(\d+)\s*min\]\s*(.+)/i);
      if (m) return { texto: m[2], tiempo_minutos: parseInt(m[1]) };
      return { texto: linea, tiempo_minutos: null };
    });
  }

  async function parsear() {
    if (!texto.trim()) return;
    if (!claveActual) {
      error = `Necesitás configurar la API key de ${proveedorActivo} en ajustes.`;
      return;
    }
    parseando = true;
    error = '';
    try {
      recetaExtraida = await api.parsearReceta(texto, config.provider, claveActual);
    } catch (e) {
      error = e.message;
    } finally {
      parseando = false;
    }
  }

  async function guardar() {
    guardando = true;
    error = '';
    try {
      const creada = await api.crearReceta({ ...recetaExtraida, origen: 'usuario' });
      navigate(`/recipe/${creada.id}`);
    } catch (e) {
      error = e.message;
      guardando = false;
    }
  }
</script>

<div class="row" style="margin-bottom: 16px;">
  <button class="icon-btn" onclick={() => volver('/')}>←</button>
  <h2 style="margin: 0;">Agregar al cuaderno</h2>
</div>

{#if !recetaExtraida}
  <div class="card">
    <p class="muted">
      Pegá una receta que viste por ahí — en texto libre, tal cual la copiaste.
      La IA la pone en limpio para que entre al cuaderno.
    </p>

    <hr class="divider" />

    <textarea
      class="textarea"
      placeholder="Vi esta receta en Instagram: para hacer arroz chaufa necesitás…"
      bind:value={texto}
      style="min-height: 180px;"
    ></textarea>

    {#if error}
      <p style="color: var(--danger); margin: 10px 0;">{error}</p>
    {/if}

    <button class="btn btn-primary" onclick={parsear} disabled={parseando || !texto.trim()} style="margin-top: 14px;">
      {parseando ? 'Procesando…' : 'Procesar receta'}
    </button>

    {#if !claveActual}
      <p class="muted small" style="margin-top: 10px;">
        Necesitás una API key de {proveedorActivo}
        (<a href="#/settings">configurar</a>).
      </p>
    {/if}
  </div>
{:else}
  <div class="card">
    <h3>Revisá antes de guardar</h3>
    <p class="muted small">Editá lo que sea necesario antes de pasarla al cuaderno.</p>

    <hr class="divider" />

    <div class="col" style="gap: 12px;">
      <div>
        <label class="small" for="r-nombre">Nombre</label>
        <input id="r-nombre" class="input" bind:value={recetaExtraida.nombre} />
      </div>

      <div class="row" style="gap: 12px;">
        <div style="flex: 1;">
          <label class="small" for="r-tiempo">Tiempo (min)</label>
          <input id="r-tiempo" class="input" type="number" bind:value={recetaExtraida.tiempo_minutos} />
        </div>
        <div style="flex: 1;">
          <label class="small" for="r-porc">Porciones</label>
          <input id="r-porc" class="input" type="number" bind:value={recetaExtraida.porciones} />
        </div>
        <div style="flex: 1;">
          <label class="small" for="r-dif">Dificultad</label>
          <select id="r-dif" class="input" bind:value={recetaExtraida.dificultad}>
            <option value="facil">fácil</option>
            <option value="media">media</option>
          </select>
        </div>
      </div>

      <div>
        <label class="small">Ingredientes esenciales</label>
        <p class="muted small" style="margin-top: 0;">Formato por línea: <code>cantidad unidad nombre</code> · ej: <code>500 g pollo</code></p>
        <textarea class="textarea" style="min-height: 110px;"
                  value={recetaExtraida.ingredientes_esenciales.map(formatIng).join('\n')}
                  oninput={(e) => recetaExtraida.ingredientes_esenciales = parsearIngs(e.target.value)}></textarea>
      </div>

      <div>
        <label class="small">Ingredientes opcionales</label>
        <textarea class="textarea" style="min-height: 70px;"
                  value={recetaExtraida.ingredientes_opcionales.map(formatIng).join('\n')}
                  oninput={(e) => recetaExtraida.ingredientes_opcionales = parsearIngs(e.target.value)}></textarea>
      </div>

      <div>
        <label class="small">Pasos</label>
        <p class="muted small" style="margin-top: 0;">Una línea por paso. Opcional al inicio: <code>[5 min]</code> para tiempo del paso.</p>
        <textarea class="textarea" style="min-height: 160px;"
                  value={recetaExtraida.pasos.map(formatPaso).join('\n')}
                  oninput={(e) => recetaExtraida.pasos = parsearPasos(e.target.value)}></textarea>
      </div>

      {#if error}
        <p style="color: var(--danger); margin: 0;">{error}</p>
      {/if}

      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" onclick={() => { recetaExtraida = null; }}>Volver</button>
        <button class="btn btn-primary" onclick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar en el cuaderno'}
        </button>
      </div>
    </div>
  </div>
{/if}
