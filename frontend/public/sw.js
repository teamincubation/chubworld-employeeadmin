// Service Worker for C-Hub ESS PWA
const CACHE_NAME = 'chub-ess-cache-v2'; // Bump version to force update
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.jpeg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((err) => console.log('SW install caching skipped:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  // Do not intercept API requests
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Network First, falling back to Cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, update the cache for static files
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is offline or fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the resource is index.html or document, we can fallback to the cached root
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
