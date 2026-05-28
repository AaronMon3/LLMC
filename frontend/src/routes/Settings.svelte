<script>
  import { get } from 'svelte/store';
  import { navigate, volver } from '../router.js';
  import { llmConfig, PROVIDERS, spotifyConectado, recordarKeys, borrarTodosLosDatos } from '../stores.js';
  import { iniciarLogin, cerrarSesion, migrarTokensSegunRecordar } from '../lib/spotify/auth.js';
  import { getPerfil } from '../lib/spotify/api.js';

  const inicial = get(llmConfig);
  let provider = $state(inicial.provider || 'groq');
  let keys = $state({ groq: '', claude: '', openai: '', ...(inicial.keys || {}) });
  let keyInput = $state(keys[provider] || '');
  let guardado = $state(false);

  let info = $derived(PROVIDERS[provider]);
  let placeholder = $derived(
    provider === 'claude' ? 'sk-ant-…' :
    provider === 'groq' ? 'gsk_…' : 'sk-…'
  );

  function elegirProveedor(id) {
    keys = { ...keys, [provider]: keyInput };
    provider = id;
    keyInput = keys[id] || '';
  }

  function guardar() {
    const nuevasKeys = { ...keys, [provider]: keyInput.trim() };
    keys = nuevasKeys;
    llmConfig.set({ provider, keys: nuevasKeys });
    guardado = true;
    setTimeout(() => guardado = false, 2000);
  }

  function borrar() {
    if (!confirm(`¿Borrar la API key de ${info.nombre}?`)) return;
    keyInput = '';
    const nuevasKeys = { ...keys, [provider]: '' };
    keys = nuevasKeys;
    llmConfig.set({ provider, keys: nuevasKeys });
  }

  let conectado = $state(false);
  let perfilSpotify = $state(null);
  let cargandoSpotify = $state(false);

  $effect(() => {
    const unsub = spotifyConectado.subscribe((v) => { conectado = v; });
    return unsub;
  });

  $effect(() => {
    if (conectado && !perfilSpotify) {
      cargandoSpotify = true;
      getPerfil()
        .then((p) => { perfilSpotify = p; })
        .catch(() => { perfilSpotify = null; })
        .finally(() => { cargandoSpotify = false; });
    } else if (!conectado) {
      perfilSpotify = null;
    }
  });

  function conectarSpotify() {
    iniciarLogin().catch((e) => alert('Error: ' + e.message));
  }

  function desconectarSpotify() {
    if (!confirm('¿Desconectar tu cuenta de Spotify?')) return;
    cerrarSesion();
    spotifyConectado.set(false);
    perfilSpotify = null;
  }

  let recordar = $state(false);
  $effect(() => {
    const u = recordarKeys.subscribe((v) => { recordar = v; });
    return u;
  });

  function toggleRecordar(nuevo) {
    recordar = nuevo;
    recordarKeys.set(nuevo);
    migrarTokensSegunRecordar();
  }

  let borrandoTodo = $state(false);
  async function borrarTodo() {
    const ok = confirm(
      '¿BORRAR TODOS tus datos locales?\n\n' +
      'Esto incluye: API keys, conexión Spotify, recetas cargadas, ' +
      'favoritos, lista de compras, historial y despensa.\n\n' +
      'Esta acción no se puede deshacer.'
    );
    if (!ok) return;
    borrandoTodo = true;
    try {
      await borrarTodosLosDatos();
      window.location.reload();
    } catch (e) {
      alert('Error: ' + e.message);
      borrandoTodo = false;
    }
  }
</script>

<div class="row" style="margin-bottom: 16px;">
  <button class="icon-btn" onclick={() => volver('/')}>←</button>
  <h2 style="margin: 0;">Ajustes</h2>
</div>

<div class="card">
  <h3>Proveedor de IA</h3>
  <p class="muted small">Elegí qué servicio usar para las funciones con IA.</p>

  <hr class="divider" />

  <div class="col">
    {#each Object.entries(PROVIDERS) as [id, p]}
      <button
        type="button"
        onclick={() => elegirProveedor(id)}
        style="cursor: pointer; padding: 12px 14px;
               border: 1.5px solid {provider === id ? 'var(--primary)' : 'var(--paper-edge)'};
               background: {provider === id ? 'var(--paper)' : 'transparent'};
               border-radius: 2px; text-align: left; font: inherit; color: inherit;
               display: flex; align-items: center; gap: 12px;">
        <span style="display: inline-block; width: 16px; height: 16px;
                     border-radius: 50%;
                     border: 2px solid {provider === id ? 'var(--primary)' : 'var(--paper-edge)'};
                     background: {provider === id ? 'var(--primary)' : 'transparent'};
                     box-shadow: inset 0 0 0 3px var(--paper-2);
                     flex-shrink: 0;"></span>
        <div style="flex: 1;">
          <div style="font-weight: 600;">{p.nombre}</div>
          <div class="small muted">modelo: {p.modelo}</div>
        </div>
        {#if keys[id]}
          <span class="tag tag-green">con key</span>
        {:else}
          <span class="tag tag-red">sin key</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<div class="card">
  <h3>API key de {info.nombre}</h3>
  <p class="muted small">
    Tu key se guarda solo en tu navegador, nunca pasa por nuestro servidor.
    Conseguila en <a href={info.urlKey} target="_blank" rel="noopener">{info.urlKey.replace('https://', '')}</a>.
  </p>

  <div class="row" style="margin-top: 10px; padding: 10px 12px; background: #f3eedb; border-left: 3px solid var(--warning); border-radius: 2px; gap: 10px;">
    <div class="small" style="color: var(--ink); flex: 1;">
      <strong>⚠ Importante:</strong> tu API key queda en {recordar ? 'localStorage (persistente entre sesiones)' : 'sessionStorage (solo en esta pestaña)'}.
      No uses esta app en computadoras compartidas con tu key personal.
    </div>
  </div>

  <label class="row" style="margin-top: 10px; padding: 8px 4px; cursor: pointer; gap: 10px;">
    <input type="checkbox" checked={recordar} onchange={(e) => toggleRecordar(e.target.checked)} style="margin: 0;" />
    <div style="flex: 1;">
      <div class="small" style="font-style: normal; color: var(--ink);">Recordar mi key entre sesiones</div>
      <div class="small muted">
        {recordar
          ? 'Tu key sigue guardada aunque cierres el navegador'
          : 'Tu key se borra al cerrar esta pestaña (más seguro)'}
      </div>
    </div>
  </label>

  <input
    class="input"
    type="password"
    placeholder={placeholder}
    bind:value={keyInput}
    style="margin-top: 14px;"
  />

  <div class="row" style="gap: 10px; margin-top: 14px;">
    <button class="btn btn-primary" onclick={guardar} disabled={!keyInput.trim()}>
      {guardado ? '✓ Guardado' : 'Guardar'}
    </button>
    {#if keys[provider]}
      <button class="btn btn-ghost" onclick={borrar}>Borrar</button>
    {/if}
  </div>
</div>

<div class="card">
  <h3>🎵 Spotify</h3>
  <p class="muted small">
    Conectá tu cuenta para reproducir música mientras cocinás. Vemos tus playlists
    para que las elijas desde acá. Tu cuenta se autentica directo con Spotify.
  </p>

  <hr class="divider" />

  {#if conectado}
    <div class="row" style="gap: 12px; align-items: center; padding: 10px 14px;
                            background: var(--paper); border: 1px solid var(--paper-edge); border-radius: 2px;">
      <div style="flex: 1;">
        {#if perfilSpotify}
          <div style="font-weight: 600;">{perfilSpotify.display_name || 'Conectado'}</div>
          <div class="small muted" style="font-style: normal;">
            {perfilSpotify.product === 'premium' ? 'Premium' : 'Free'}
          </div>
        {:else if cargandoSpotify}
          <div class="muted small">Verificando cuenta...</div>
        {:else}
          <div class="muted small">Conectado</div>
        {/if}
      </div>
      <span class="tag tag-green">✓ activo</span>
    </div>
    <button class="btn btn-ghost" onclick={desconectarSpotify} style="margin-top: 12px;">
      Desconectar Spotify
    </button>
  {:else}
    <button class="btn btn-primary" onclick={conectarSpotify}>
      Conectar con Spotify
    </button>
    <p class="muted small" style="margin-top: 10px;">
      Te va a abrir Spotify para autorizar el acceso. Después volvés acá automáticamente.
    </p>
  {/if}
</div>

<div class="card">
  <h3>Sin API key</h3>
  <p class="muted small" style="margin: 0;">
    El recetario funciona sin key. Sin ella no podés:
  </p>
  <ul class="recipe-list" style="margin-top: 8px;">
    <li class="small">Cargar recetas pegando texto libre</li>
    <li class="small">Pedirle dudas al chef durante la preparación</li>
    <li class="small">Generar variedad con la IA en los resultados</li>
  </ul>
</div>

<div class="card" style="border: 1px dashed var(--danger);">
  <h3 style="color: var(--danger);">🗑 Borrar todos mis datos</h3>
  <p class="small muted" style="margin: 0;">
    Limpia <strong style="color: var(--ink);">absolutamente todo</strong> lo guardado en este navegador:
  </p>
  <ul class="recipe-list" style="margin-top: 8px;">
    <li class="small">API keys de los proveedores LLM</li>
    <li class="small">Conexión y tokens de Spotify</li>
    <li class="small">Recetas cargadas o generadas por IA</li>
    <li class="small">Favoritos, historial, despensa, restricciones</li>
    <li class="small">Lista de compras y búsquedas guardadas</li>
  </ul>
  <p class="small muted" style="margin: 10px 0;">
    Útil antes de prestar tu PC, o si querés empezar de cero.
  </p>
  <button class="btn btn-ghost" style="color: var(--danger); border-color: var(--danger);"
          onclick={borrarTodo} disabled={borrandoTodo}>
    {borrandoTodo ? 'Borrando…' : 'Borrar todo'}
  </button>
</div>

<div class="card">
  <h3>Sobre LLMC</h3>
  <p class="small muted" style="margin: 0;">
    Proyecto abierto. La búsqueda y el ranking son locales, sin tokens.
    La IA solo entra cuando realmente aporta — y la pagás vos directo al proveedor
    (o usás Groq, que tiene tier gratuito).
  </p>
</div>
