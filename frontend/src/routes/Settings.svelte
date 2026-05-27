<script>
  import { get } from 'svelte/store';
  import { navigate, volver } from '../router.js';
  import { llmConfig, PROVIDERS } from '../stores.js';

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

<div class="card">
  <h3>Sobre CocinAI</h3>
  <p class="small muted" style="margin: 0;">
    Proyecto abierto. La búsqueda y el ranking son locales, sin tokens.
    La IA solo entra cuando realmente aporta — y la pagás vos directo al proveedor
    (o usás Groq, que tiene tier gratuito).
  </p>
</div>
