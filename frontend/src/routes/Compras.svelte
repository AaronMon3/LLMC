<script>
  import { volver } from '../router.js';
  import { listaCompras } from '../stores.js';
  import { formatearIngrediente } from '../lib/format.js';

  let items = $state([]);

  $effect(() => {
    const unsub = listaCompras.subscribe((v) => { items = v; });
    return unsub;
  });

  function toggleMarcado(idx) {
    const nuevo = [...items];
    nuevo[idx] = { ...nuevo[idx], marcado: !nuevo[idx].marcado };
    listaCompras.set(nuevo);
  }

  function eliminar(idx) {
    listaCompras.set(items.filter((_, i) => i !== idx));
  }

  function borrarMarcados() {
    if (!items.some((i) => i.marcado)) return;
    listaCompras.set(items.filter((i) => !i.marcado));
  }

  function vaciar() {
    if (!confirm('¿Vaciar toda la lista de compras?')) return;
    listaCompras.set([]);
  }

  function copiarTexto() {
    const txt = items.map((i) => {
      const tick = i.marcado ? '✓' : '○';
      return `${tick} ${formatearItem(i)}`;
    }).join('\n');
    navigator.clipboard.writeText(txt).then(() => {
      alert('Lista copiada al portapapeles');
    }).catch(() => {});
  }

  function formatearItem(it) {
    if (!it.cantidad || it.unidad === 'al gusto') return it.nombre;
    const ing = { nombre: it.nombre, cantidad: it.cantidad, unidad: it.unidad };
    return formatearIngrediente(ing, 1, 1);
  }

  let pendientes = $derived(items.filter((i) => !i.marcado));
  let listos = $derived(items.filter((i) => i.marcado));
</script>

<div class="row" style="margin-bottom: 16px;">
  <button class="icon-btn" onclick={() => volver('/')}>←</button>
  <h2 style="margin: 0; flex: 1;">Lista de compras</h2>
</div>

{#if items.length === 0}
  <div class="card">
    <p class="muted" style="margin: 0;">
      La lista está vacía. Desde una receta tocá <strong style="color: var(--ink);">"+ a lista de compras"</strong>
      para agregar los ingredientes que te faltan.
    </p>
  </div>
{:else}
  <div class="card">
    <div class="row" style="gap: 10px; flex-wrap: wrap;">
      <span class="tag">{pendientes.length} pendientes</span>
      {#if listos.length > 0}
        <span class="tag tag-green">{listos.length} ✓</span>
      {/if}
      <div class="spacer"></div>
      <button class="btn-ghost btn" style="width: auto; padding: 6px 12px; font-size: 12px;"
              onclick={copiarTexto}>
        copiar
      </button>
      {#if listos.length > 0}
        <button class="btn-ghost btn" style="width: auto; padding: 6px 12px; font-size: 12px;"
                onclick={borrarMarcados}>
          quitar marcados
        </button>
      {/if}
      <button class="btn-ghost btn" style="width: auto; padding: 6px 12px; font-size: 12px; color: var(--danger);"
              onclick={vaciar}>
        vaciar todo
      </button>
    </div>
  </div>

  <div class="card">
    {#each items as it, i (it.nombre + it.unidad + i)}
      <label class="row" style="cursor: pointer; padding: 10px 0; gap: 12px;
                                {i < items.length - 1 ? 'border-bottom: 1px dashed var(--paper-edge);' : ''}">
        <input type="checkbox" checked={it.marcado} onchange={() => toggleMarcado(i)} style="margin: 0; transform: scale(1.3);" />
        <div style="flex: 1; {it.marcado ? 'text-decoration: line-through; color: var(--ink-soft);' : ''}">
          {formatearItem(it)}
        </div>
        <button class="icon-btn" onclick={(e) => { e.preventDefault(); eliminar(i); }}
                style="font-size: 18px; color: var(--ink-soft);">×</button>
      </label>
    {/each}
  </div>
{/if}
