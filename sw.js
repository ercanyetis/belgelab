const CACHE_NAME = "belgelab-cache-v41";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  OFFLINE_URL,
  "/style.css",
  "/app.js",
  "/editor-split.js",
  "/tools.js",
  "/creators.js",
  "/tool-navigation.js",
  "/consent.js",
  "/ads.js",
  "/favicon.ico",
  "/favicon-48.png",
  "/apple-touch-icon.png",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];
const STATIC_PATHS = new Set(STATIC_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (STATIC_PATHS.has(requestUrl.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
