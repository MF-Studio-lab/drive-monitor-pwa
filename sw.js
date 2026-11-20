const CACHE_NAME = 'drive-monitor-v1';
const ASSETS = [
  './',
  './index.html',
  './analysis.html',
  './manifest.json',
  './styles.css',
  './app.js',
  './charts.js',
  './sensors.js',
  './storage.js',
  './api.js',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/uplot@1.6.27/dist/uPlot.iife.min.js',
  'https://cdn.jsdelivr.net/npm/uplot@1.6.27/dist/uPlot.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        return res;
      }))
    );
  }
});