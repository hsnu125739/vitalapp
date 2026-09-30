const CACHE_NAME = 'vital-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/api/apiClient.js',
  './js/store/practiceStore.js',
  './js/store/chatStore.js',
  './js/ui/dashboardView.js',
  './js/ui/profileView.js',
  './js/ui/groupFellowshipView.js',
  './js/ui/footprintsView.js',
  './js/ui/chestView.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('script.google.com') || event.request.url.includes('script.googleusercontent.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate for assets
        event.waitUntil(
          fetch(event.request).then((networkResponse) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }).catch(() => {})
        );
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
