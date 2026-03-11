const CACHE_NAME = 'teacher-planner-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Failed to cache all assets', err);
      });
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
  // We only want to intercept non-API, local GET requests for basic offline shell
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
      return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((fetchResponse) => {
        // Cache new static assets dynamically
        if (
            !fetchResponse ||
            fetchResponse.status !== 200 ||
            fetchResponse.type !== 'basic'
        ) {
            return fetchResponse;
        }

        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
        });

        return fetchResponse;
      }).catch(() => {
         // If offline and request is an HTML page, maybe return index.html
         if (event.request.headers.get('accept')?.includes('text/html')) {
             return caches.match('/');
         }
      });
    })
  );
});
