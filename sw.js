// SBTI Service Worker v3 - Network-first for JS/HTML
const CACHE_NAME = 'sbti-v4';
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
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' }, status: 503 }))
    );
    return;
  }

  // External resources (fonts, CDNs): network only, don't intercept
  if (url.origin !== self.location.origin) {
    return; // Don't intercept - let browser handle directly
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Same-origin static assets: network first, fallback to cache
  event.respondWith(
    fetch(event.request).then((response) => {
      // Cache successful responses
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Network failed, try cache
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
