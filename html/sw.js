const CACHE_NAME = 'vital-cache-v51';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './login-webp-perf.css',
  './runtime-settings.js',
  './js/utils/vitalUtils.js',
  './js/api/apiClient.js',
  './js/store/practiceStore.js',
  './js/store/chatStore.js',
  './js/ui/authView.js',
  './js/ui/dashboardView.js',
  './js/ui/chestView.js',
  './js/ui/footprintsView.js',
  './js/ui/groupFellowshipView.js',
  './js/ui/profileView.js',
  './js/app.js',
  // Chest Assets (WebP & PNG)
  '../Chest_Assets/Chest_01.webp',
  '../Chest_Assets/Chest_02.webp',
  '../Chest_Assets/Chest_03.webp',
  '../Chest_Assets/Chest_04.webp',
  '../Chest_Assets/Chest_05.webp',
  '../Chest_Assets/Chest_06.webp',
  '../Chest_Assets/Chest_07.webp',
  '../Chest_Assets/Chest_08.webp',
  '../Chest_Assets/Chest_01.png',
  '../Chest_Assets/Chest_02.png',
  '../Chest_Assets/Chest_03.png',
  '../Chest_Assets/Chest_04.png',
  '../Chest_Assets/Chest_05.png',
  '../Chest_Assets/Chest_06.png',
  '../Chest_Assets/Chest_07.png',
  '../Chest_Assets/Chest_08.png',
  './Chest_Assets/Chest_01.webp',
  './Chest_Assets/Chest_02.webp',
  './Chest_Assets/Chest_03.webp',
  './Chest_Assets/Chest_04.webp',
  './Chest_Assets/Chest_05.webp',
  './Chest_Assets/Chest_06.webp',
  './Chest_Assets/Chest_07.webp',
  './Chest_Assets/Chest_08.webp',
  './Chest_Assets/Chest_01.png',
  './Chest_Assets/Chest_02.png',
  './Chest_Assets/Chest_03.png',
  './Chest_Assets/Chest_04.png',
  './Chest_Assets/Chest_05.png',
  './Chest_Assets/Chest_06.png',
  './Chest_Assets/Chest_07.png',
  './Chest_Assets/Chest_08.png',
  // Journey Assets (WebP)
  '../Chest_Assets/journey_1.webp',
  '../Chest_Assets/journey_2.webp',
  '../Chest_Assets/journey_3.webp',
  '../Chest_Assets/journey_4.webp',
  '../Chest_Assets/journey_5.webp',
  '../Chest_Assets/journey_6.webp',
  '../Chest_Assets/journey_7.webp',
  '../Chest_Assets/journey_8.webp',
  './Chest_Assets/journey_1.webp',
  './Chest_Assets/journey_2.webp',
  './Chest_Assets/journey_3.webp',
  './Chest_Assets/journey_4.webp',
  './Chest_Assets/journey_5.webp',
  './Chest_Assets/journey_6.webp',
  './Chest_Assets/journey_7.webp',
  './Chest_Assets/journey_8.webp',
  // Cute Icons (Achievements & Special Tasks)
  '../Cute_Icons/Cute_Icon_01.png',
  '../Cute_Icons/Cute_Icon_02.png',
  '../Cute_Icons/Cute_Icon_03.png',
  '../Cute_Icons/Cute_Icon_04.png',
  '../Cute_Icons/Cute_Icon_05.png',
  '../Cute_Icons/Cute_Icon_06.png',
  '../Cute_Icons/Cute_Icon_07.png',
  '../Cute_Icons/Cute_Icon_08.png',
  '../Cute_Icons/Cute_Icon_09.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS_TO_CACHE.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (e) {
            // Ignore individual fetch errors during precache
          }
        })
      );
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
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate for assets
        event.waitUntil(
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, resClone);
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }

      // Cache miss: fetch from network and store in cache for subsequent requests
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request, { ignoreSearch: true });
      });
    })
  );
});
