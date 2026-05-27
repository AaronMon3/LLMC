<script>
  import { ruta, navigate, matchRoute } from './router.js';
  import Home from './routes/Home.svelte';
  import Results from './routes/Results.svelte';
  import Recipe from './routes/Recipe.svelte';
  import Upload from './routes/Upload.svelte';
  import Settings from './routes/Settings.svelte';
  import Favorites from './routes/Favorites.svelte';
  import All from './routes/All.svelte';

  let current = $state({ path: '/', query: {} });
  $effect(() => {
    const unsub = ruta.subscribe((v) => { current = v; });
    return unsub;
  });

  let recipeParams = $derived(matchRoute('/recipe/:id', current.path));
</script>

<nav class="nav-top">
  <button class="icon-btn" onclick={() => navigate('/')} title="Inicio" style="font-family: 'Caveat', cursive; font-size: 24px;">~</button>
  <div class="title">LLMC</div>
  <div class="spacer"></div>
  <button class="icon-btn" onclick={() => navigate('/all')} title="Todo el recetario">☰</button>
  <button class="icon-btn" onclick={() => navigate('/favorites')} title="Favoritos">★</button>
  <button class="icon-btn" onclick={() => navigate('/upload')} title="Agregar receta">+</button>
  <button class="icon-btn" onclick={() => navigate('/settings')} title="Ajustes">⚙</button>
</nav>

<main class="container">
  {#if current.path === '/'}
    <Home />
  {:else if current.path === '/results'}
    <Results query={current.query} />
  {:else if recipeParams}
    <Recipe id={recipeParams.id} />
  {:else if current.path === '/upload'}
    <Upload />
  {:else if current.path === '/settings'}
    <Settings />
  {:else if current.path === '/favorites'}
    <Favorites />
  {:else if current.path === '/all'}
    <All />
  {:else}
    <div class="card">
      <h3>Esta página no existe</h3>
      <button class="btn btn-primary" onclick={() => navigate('/')}>Volver al inicio</button>
    </div>
  {/if}
</main>
