// SBTI Service Worker - No-cache version
// This SW only provides offline fallback, does NOT cache any static assets

self.addEventListener('install', () => {
  // Clear all existing caches on install
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear all caches on activate
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_UPDATE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.skipWaiting());
  }
});

// Fetch: always network, no caching
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network only
  if (url.hostname === 'api.sbti.solutions') {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' }, status: 503 }))
    );
    return;
  }

  // External: don't intercept
  if (url.origin !== self.location.origin) return;

  // Non-GET: don't intercept
  if (event.request.method !== 'GET') return;

  // All same-origin requests: network only, clear any old cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then(c => c || new Response('Offline', { status: 503 })))
  );
});
