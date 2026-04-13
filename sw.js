// ═══════════════════════════════════════════════════
//  Service Worker — 离线缓存
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'chronos-v13';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/ical-parser.js',
  './js/memory-schedule.js',
  './js/scheduler.js',
  './js/sync.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // 对 iCal / CORS 代理请求走网络优先
  if (event.request.url.includes('allorigins') || event.request.url.includes('ical')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 其他资源走缓存优先
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
