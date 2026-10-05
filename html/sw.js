const CACHE_NAME = 'vital-cache-v52';
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
  const url = event.request.url;
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) return;

  // 判斷是否為核心邏輯層（HTML 導覽、JS 腳本、CSS 樣式表、JSON 設定檔、根路徑）
  // 這些檔案採用【Network-First（網路優先）】策略，確保使用者一按重新整理就能 100% 即刻載入最新程式碼
  const isLogicAsset = event.request.mode === 'navigate' ||
                       url.endsWith('/') ||
                       url.includes('/html/') ||
                       url.endsWith('.html') ||
                       url.includes('.html?') ||
                       url.includes('/js/') ||
                       url.endsWith('.js') ||
                       url.includes('.js?') ||
                       url.endsWith('.css') ||
                       url.includes('.css?') ||
                       url.endsWith('.json') ||
                       url.includes('.json?');

  if (isLogicAsset) {
    // 【Network-First 策略】有網路時永遠抓伺服器最新代碼；只有斷網或離線時才退回讀快取
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, resClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 離線回退：從快取中讀取
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // 若找不到且為導覽請求，回退至 index.html
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html') || caches.match('./');
            }
            return null;
          });
        })
    );
    return;
  }

  // 【Cache-First 策略】圖片、圖示、WebP/PNG 等大型靜態資源：快取優先，節省流量並保證秒開
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
