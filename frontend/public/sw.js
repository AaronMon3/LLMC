const CACHE_VERSION = 'llmc-v1';
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const ESENCIALES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then((cache) => cache.addAll(ESENCIALES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') || url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copia = res.clone();
          caches.open(ASSETS_CACHE).then((c) => c.put(request, copia));
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copia = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copia));
        return res;
      })
      .catch(() => caches.match(request).then((c) => c || caches.match('/')))
  );
});
