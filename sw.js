const SHELL_CACHE = 'alquran-play-shell-v3';
const DATA_CACHE = 'alquran-play-data-v3';
const AUDIO_CACHE = 'alquran-play-audio-v3';

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
  const allowed = [SHELL_CACHE, DATA_CACHE, AUDIO_CACHE];
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

  // 1. Audio Murottal MP3 (Cache-First)
  if (
    url.hostname.includes('everyayah.com') ||
    url.hostname.includes('cdn.islamic.network') ||
    url.pathname.endsWith('.mp3')
  ) {
    if (req.headers.has('range')) {
      event.respondWith(fetch(req));
      return;
    }
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const networkRes = await fetch(req);
          if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          return new Response('', { status: 503, statusText: 'Audio Offline Unavailable' });
        }
      })
    );
    return;
  }

  // 2. API Teks Al-Qur'an (AlQuran Cloud & Quran.com) - Lewatkan langsung & simpan di IndexedDB
  if (url.hostname.includes('api.alquran.cloud') || url.hostname.includes('api.quran.com')) {
    event.respondWith(fetch(req));
    return;
  }

  // 3. Google Fonts (Stale-While-Revalidate)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
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

  // 4. App Shell Lokal (Network-First agar pembaruan kode langsung aktif, fallback ke Cache saat offline)
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
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
  }
});
