const VERSION = 'wushu-offline-v1';
const CORE = [
  './', './index.html', './styles.css', './campus.css', './journey.css', './journey.js',
  './story.js', './config.js', './practice.js', './practice-extra.css', './adventure.js',
  './adventure.css', './forms.js', './forms.css', './action-games.js', './action-games.css',
  './manifest.webmanifest', './resources/icon/game-icon-512.png', './resources/icon/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(VERSION).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
