const SHELL_CACHE = 'alquran-go-shell-v4';
const FONT_CACHE = 'alquran-go-fonts-v4';

const SHELL_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const allowed = [SHELL_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!allowed.includes(key)) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. API Teks & Audio CDN dilewatkan langsung (penyimpanan offline penuh dikelola di IndexedDB sebagai Blob & JSON)
  if (
    url.hostname.includes('api.alquran.cloud') ||
    url.hostname.includes('api.quran.com') ||
    url.hostname.includes('cdn.islamic.network') ||
    url.hostname.includes('verses.quran.com') ||
    url.hostname.includes('everyayah.com')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // 2. Google Fonts (Stale-While-Revalidate)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && (res.status === 200 || res.type === 'opaque')) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. App Shell Lokal (Network-First agar pembaruan kode langsung masuk, fallback ke Cache saat offline)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((c) => c || caches.match('./index.html'))
        )
    );
  }
});
