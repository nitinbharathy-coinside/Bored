// Minimal offline cache for the app shell. Bump CACHE_NAME when shipping
// changes to any cached file so clients pick up the new version.
const CACHE_NAME = 'bored-v3';
const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'filter.js',
  'data.js',
  'holidays.js',
  'weather.js',
  'manifest.json',
  'icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Only manage caching for the app's own files. Cross-origin requests (the
  // live NEA weather API in particular) must always hit the network —
  // caching them would serve stale weather forever once cached.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
