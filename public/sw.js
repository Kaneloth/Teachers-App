const CACHE_NAME = 'crosssa-v6';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching offline page');
        return cache.add(OFFLINE_URL);
      })
      .then(() => {
        console.log('[SW] Offline page cached');
        self.skipWaiting();
      })
      .catch((err) => console.error('[SW] Cache add failed', err))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Deleting old cache', key);
          return caches.delete(key);
        }
      }));
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  console.log('[SW] Fetch', url);
  if (event.request.mode === 'navigate') {
    console.log('[SW] Navigation request, trying network then offline fallback');
    event.respondWith(
      fetch(event.request).catch((error) => {
        console.error('[SW] Network failed, returning offline page', error);
        return caches.match(OFFLINE_URL);
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          console.log('[SW] Cache hit', url);
          return response;
        }
        console.log('[SW] Cache miss, fetching', url);
        return fetch(event.request);
      })
    );
  }
});