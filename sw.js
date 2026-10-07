const CACHE_NAME = 'blohsh-blast-v8';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './logo-official-64.png',
  './phase3.js',
  './legacy-game.js'
];

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isApiRequest(url) {
  return url.pathname === '/api' || url.pathname.startsWith('/api/');
}

function isStaticAssetRequest(request) {
  return ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
}

async function cacheBuiltAssets(cache) {
  const response = await fetch('./index.html', { cache: 'no-store' });
  if (!response.ok) return;

  const html = await response.text();
  const assetUrls = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/gi;
  let match;

  while ((match = attributePattern.exec(html)) !== null) {
    const value = match[1];
    if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:')) continue;

    const url = new URL(value, self.location.href);
    if (url.origin === self.location.origin && ['http:', 'https:'].includes(url.protocol)) {
      assetUrls.add(url.href);
    }
  }

  await Promise.all([...assetUrls].map(async url => {
    try {
      const assetResponse = await fetch(url, { cache: 'no-store' });
      if (assetResponse.ok) await cache.put(url, assetResponse.clone());
    } catch (_) {
      // A single optional asset must not prevent the application shell from installing.
    }
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await cache.addAll(APP_SHELL);
        await cacheBuiltAssets(cache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;

  const url = new URL(request.url);
  if (isApiRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) return response;
          throw new Error('Navigation failed with ' + response.status);
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (!isStaticAssetRequest(request)) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (!response.ok) return response;

        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});
