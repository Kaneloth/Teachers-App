const CACHE_NAME = 'crosssa-v7';
const OFFLINE_URL = '/offline.html';

// App shell — everything needed to run the app without a network connection.
// Vite hashes JS/CSS filenames on every build, so we cache the entry points
// that are STABLE (index.html, offline.html, manifest, icons) and rely on
// a network-first strategy for the hashed bundles so they always stay fresh.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: pre-cache the stable shell ───────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Pre-cache failed', err))
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests (ignore Supabase, fonts, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests (POST to Supabase, etc.)
  if (request.method !== 'GET') return;

  // ── Navigation requests (page loads) ──────────────────────────────────────
  // Network-first: try to get a fresh page; fall back to cached index.html so
  // the React SPA can handle the route, or finally the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a fresh copy of index.html on every successful load
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Offline: serve cached index.html (SPA handles the route) or offline page
          caches.match('/index.html').then((r) => r || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // ── Hashed JS/CSS bundles (Vite build output) ────────────────────────────
  // These filenames contain a content hash, so cache-first is safe.
  // Once cached they never go stale; new deploys produce new filenames.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Everything else (icons, manifest, favicon) ────────────────────────────
  // Cache-first with network fallback.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});