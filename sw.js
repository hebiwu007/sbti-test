// SBTI Service Worker - Offline Cache
const CACHE_NAME = 'sbti-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/i18n.js',
  '/personalities.json',
  '/questions.json',
  '/privacy.html',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network only (no cache)
  if (url.hostname === 'sbti-api.hebiwu007.workers.dev') {
    return;
  }

  // Static assets: cache first, fallback to network
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          // Cache successful responses for static files
          if (response.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.json') || url.pathname.endsWith('.html') || url.pathname.endsWith('.css'))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => {
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
    );
  }
});
