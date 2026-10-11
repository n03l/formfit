'use strict';
// Bump CACHE whenever any file in SHELL changes so clients pick up the new version.
const CACHE = 'formfit-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      // Only our own old caches: other sites on the same github.io origin share this cache storage.
      .then(keys => Promise.all(keys.filter(k => k.startsWith('formfit-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: network first (so updates show up straight away), falling back to the cache when offline or slow.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (response.ok && response.type === 'basic') cache.put('./', response.clone());
    return response;
  } catch {
    return (await cache.match('./')) || (await cache.match('./index.html')) || Response.error();
  }
}

// Everything else in the app shell: cache first.
async function handleAsset(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

function isAppPage(url) {
  const root = new URL('./', self.registration.scope).pathname;
  return url.pathname === root || url.pathname === root + 'index.html';
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    if (isAppPage(url)) event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(handleAsset(request));
});
