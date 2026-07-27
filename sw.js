const CACHE_NAME = 'belgelab-cache-v33';
const ASSETS = ['/', '/index.html', '/offline.html', '/style.css', '/app.js', '/tools.js', '/creators.js', '/consent.js', '/ads.js', '/favicon.ico', '/favicon-48.png', '/apple-touch-icon.png', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.json', '/hakkimizda.html', '/rehberler.html', '/iletisim.html', '/privacy.html', '/kvkk.html', '/cookies.html', '/terms.html', '/licenses.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('/offline.html');
        return Response.error();
      }))
  );
});
