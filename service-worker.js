// public/service-worker.js
// FitAI Coach Progressive Web App Service Worker with cache-first and network fallback

const CACHE_NAME = 'fitai-coach-v1.0';
const STATIC_ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'css/sathi.css',
  'js/app.js',
  'js/auth.js',
  'js/calories.js',
  'js/nutrition.js',
  'js/water.js',
  'js/workouts.js',
  'js/pose.js',
  'js/dashboard.js',
  'js/chatbot.js',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let API requests bypass cache
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback
      return caches.match('/index.html');
    })
  );
});
