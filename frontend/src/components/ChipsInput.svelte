<script>
  let {
    valores = $bindable([]),
    sugerencias = [],
    placeholder = 'agregar…',
    onbuscar = null,
  } = $props();

  let texto = $state('');
  let foco = $state(false);
  let indiceSugerencia = $state(0);
  let inputEl = $state(null);

  let sugerenciasFiltradas = $derived.by(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return [];
    const ya = new Set(valores.map((v) => v.toLowerCase()));
    return sugerencias
      .filter((s) => !ya.has(s.toLowerCase()) && s.toLowerCase().includes(q))
      .slice(0, 6);
  });

  function agregar(valor) {
    const v = valor.trim();
    if (!v) return;
    const ya = valores.some((x) => x.toLowerCase() === v.toLowerCase());
    if (!ya) valores = [...valores, v];
    texto = '';
    indiceSugerencia = 0;
  }

  function eliminar(idx) {
    valores = valores.filter((_, i) => i !== idx);
  }

  function onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sugerenciasFiltradas.length > 0) {
        agregar(sugerenciasFiltradas[indiceSugerencia] || sugerenciasFiltradas[0]);
      } else if (texto.trim()) {
        agregar(texto);
      } else if (onbuscar) {
        onbuscar();
      }
    } else if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (texto.trim()) agregar(texto);
    } else if (e.key === 'Tab' && sugerenciasFiltradas.length > 0) {
      e.preventDefault();
      agregar(sugerenciasFiltradas[indiceSugerencia] || sugerenciasFiltradas[0]);
    } else if (e.key === 'Backspace' && !texto && valores.length > 0) {
      eliminar(valores.length - 1);
    } else if (e.key === 'ArrowDown' && sugerenciasFiltradas.length > 0) {
      e.preventDefault();
      indiceSugerencia = (indiceSugerencia + 1) % sugerenciasFiltradas.length;
    } else if (e.key === 'ArrowUp' && sugerenciasFiltradas.length > 0) {
      e.preventDefault();
      indiceSugerencia = (indiceSugerencia - 1 + sugerenciasFiltradas.length) % sugerenciasFiltradas.length;
    } else if (e.key === 'Escape') {
      texto = '';
    }
  }

  function onPaste(e) {
    const datos = e.clipboardData?.getData('text');
    if (!datos || !/[,;\n]/.test(datos)) return;
    e.preventDefault();
    const items = datos.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    for (const it of items) agregar(it);
  }
</script>

<div class="chips-input" class:focused={foco} onclick={() => inputEl?.focus()} role="textbox" tabindex="-1">
  {#each valores as v, i (v + i)}
    <span class="chip">
      {v}
      <button class="chip-x" onclick={(e) => { e.stopPropagation(); eliminar(i); }} title="Quitar" aria-label="Quitar {v}">×</button>
    </span>
  {/each}

  <input
    bind:this={inputEl}
    type="text"
    {placeholder}
    bind:value={texto}
    onkeydown={onKey}
    onpaste={onPaste}
    onfocus={() => foco = true}
    onblur={() => setTimeout(() => foco = false, 150)}
  />
</div>

{#if foco && sugerenciasFiltradas.length > 0}
  <div class="chips-sugerencias">
    {#each sugerenciasFiltradas as s, i}
      <button
        class="sugerencia"
        class:activa={i === indiceSugerencia}
        onmousedown={(e) => { e.preventDefault(); agregar(s); }}>
        {s}
      </button>
    {/each}
  </div>
{/if}

<style>
  .chips-input {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--paper-edge);
    border-radius: 2px;
    background: rgba(255, 253, 246, 0.5);
    min-height: 50px;
    cursor: text;
    align-items: center;
  }
  .chips-input.focused { border-color: var(--primary); }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px 4px 10px;
    background: var(--paper);
    border: 1px solid var(--paper-edge);
    border-radius: 999px;
    font-size: 14px;
    color: var(--ink);
  }

  .chip-x {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--ink-soft);
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .chip-x:hover { background: var(--danger); color: white; }

  input {
    flex: 1;
    min-width: 120px;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 15px;
    color: var(--ink);
    padding: 4px 0;
  }
  input:focus { outline: none; }

  .chips-sugerencias {
    background: var(--paper-2);
    border: 1px solid var(--paper-edge);
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 12px rgba(61, 40, 23, 0.1);
    margin-top: -1px;
  }

  .sugerencia {
    display: block;
    width: 100%;
    padding: 8px 14px;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: var(--ink);
    font-size: 14px;
  }
  .sugerencia:hover, .sugerencia.activa {
    background: var(--paper);
    color: var(--primary);
  }
</style>
