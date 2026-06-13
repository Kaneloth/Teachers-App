const CACHE_NAME = 'crosssa-v3';
const urlsToCache = [
  '/',
  '/home',
  '/login',
  '/register',
  '/offline.html',
  '/manifest.json',
  '/index.html',
  '/src/main.tsx',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install – cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate – clean old caches and take control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(() => self.clients.claim())
  );
});

// Fetch – serve from cache, fallback to network, then offline page
self.addEventListener('fetch', event => {
  // Only handle requests from our own origin
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).catch(() => {
          // If navigation request (HTML page) and offline, show offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          // For other assets, return a simple offline message
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});