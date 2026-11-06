const CACHE_NAME = 'clawops-cache-v5-1793981467183';

// 核心靜態檔案清單（含 Vite 打包產物）
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./assets/index-BOLzli13.js",
  "./assets/index-ueTCiQIm.css"
];

// 安裝階段：快取核心靜態檔案
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(PRECACHE_ASSETS).catch((err) => console.warn('Pre-cache error:', err));
    })
  );
});

// 啟動階段：清理舊版本快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截所有網路請求
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. 如果是 API 請求，走網路
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: '目前處於離線狀態' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // 2. 導航模式 (打開或刷新網頁)：Network First，斷網時回傳快取的 index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((res) => res || caches.match('./index.html') || caches.match('./') || caches.match('/index.html') || caches.match('/'));
        })
    );
    return;
  }

  // 3. 靜態資源 (JS, CSS, 圖示)：Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        if (request.url.startsWith(self.location.origin) || request.url.includes('fonts.gstatic.com') || request.url.includes('fonts.googleapis.com')) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        return new Response('', { status: 404, statusText: 'Offline resource not found' });
      });
    })
  );
});
