<script>
  import { ruta, navigate, matchRoute } from './router.js';
  import Home from './routes/Home.svelte';
  import Results from './routes/Results.svelte';
  import Recipe from './routes/Recipe.svelte';
  import Upload from './routes/Upload.svelte';
  import Settings from './routes/Settings.svelte';
  import Favorites from './routes/Favorites.svelte';
  import All from './routes/All.svelte';
  import Compras from './routes/Compras.svelte';
  import { intercambiarCodigoPorTokens } from './lib/spotify/auth.js';
  import { spotifyConectado } from './stores.js';

  let current = $state({ path: '/', query: {} });
  $effect(() => {
    const unsub = ruta.subscribe((v) => { current = v; });
    return unsub;
  });

  let recipeParams = $derived(matchRoute('/recipe/:id', current.path));

  async function manejarCallbackSpotify(url) {
    try {
      const u = new URL(url);
      const code = u.searchParams.get('code');
      const state = u.searchParams.get('state');
      const error = u.searchParams.get('error');
      if (error) {
        alert('Spotify rechazó la conexión: ' + error);
        return;
      }
      if (!code) return;
      await intercambiarCodigoPorTokens(code, state);
      spotifyConectado.set(true);
      navigate('/settings');
    } catch (e) {
      alert('Error conectando con Spotify: ' + e.message);
    }
  }

  $effect(() => {
    const intentar = async () => {
      try {
        const { App } = await import('@capacitor/app');
        App.addListener('appUrlOpen', (data) => {
          if (data?.url?.startsWith('llmc://spotify-callback')) {
            manejarCallbackSpotify(data.url);
          }
        });
      } catch {}
    };
    intentar();

    if (window.location.pathname.includes('spotify-callback')) {
      manejarCallbackSpotify(window.location.href);
    }
  });
</script>

<nav class="nav-top">
  <button class="icon-btn" onclick={() => navigate('/')} title="Inicio" style="font-family: 'Caveat', cursive; font-size: 24px;">~</button>
  <div class="title">LLMC</div>
  <div class="spacer"></div>
  <button class="icon-btn" onclick={() => navigate('/all')} title="Todo el recetario">☰</button>
  <button class="icon-btn" onclick={() => navigate('/favorites')} title="Favoritos">★</button>
  <button class="icon-btn" onclick={() => navigate('/compras')} title="Lista de compras">🛒</button>
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
  {:else if current.path === '/compras'}
    <Compras />
  {:else}
    <div class="card">
      <h3>Esta página no existe</h3>
      <button class="btn btn-primary" onclick={() => navigate('/')}>Volver al inicio</button>
    </div>
  {/if}
</main>
