const CACHE_NAME = 'blohsh-blast-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './logo-official.svg',
  './phase3.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isAppCode = /\.(?:html?|js|css)$/.test(url.pathname);
  const isNavigation = event.request.mode === 'navigate';

  const networkFirst = async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (isNavigation) return caches.match('./index.html');
        return Response.error();
      });
    }
  };

  const cacheFirst = async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  };

  event.respondWith(isNavigation || isAppCode ? networkFirst() : cacheFirst());
});
