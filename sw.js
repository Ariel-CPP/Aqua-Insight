const CACHE_NAME = 'aqua-insight-v7';

// Daftar file yang akan di-cache saat proses instalasi PWA
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/plankton-analysis.css',
  './css/colony-counter.css',
  './css/electrophoresis.css',
  './css/hematology.css',
  './js/main.js',
  './js/core/modules.js',
  './js/core/i18n.js',
  './js/core/cv-engine.js',
  './js/core/math-utils.js',
  './js/plankton/plankton-analysis.js',
  './js/colony/colony-counter.js',
  './js/wetmount/wetmount.js',
  './js/electrophoresis/electrophoresis.js',
  './js/epidemiology/epidemiology-map.js',
  './js/statistics/statistics.js',
  './js/risk/risk-analysis.js',
  './js/gene/gene-expression.js',
  './js/chart/chart-maker.js',
  './js/particle/particle-counter.js',
  './js/hematology/hematology.js',
  './pages/plankton-analysis.html',
  './pages/colony-counter.html',
  './pages/wet-mount.html',
  './pages/electrophoresis.html',
  './pages/epidemiology-map.html',
  './pages/statistics.html',
  './pages/risk-analysis.html',
  './pages/gene-expression.html',
  './pages/chart-maker.html',
  './pages/particle-counter.html',
  './pages/copernicus-viewer.html',
  './pages/bioinformatics.html',
  './pages/contact.html',
  './pages/hematology.html',
  './assets/images/logo.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  // Melakukan cache file-file inti
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Membuka cache dan menyimpan aset...');
        // menggunakan catch untuk mentoleransi kegagalan CDN
        return Promise.allSettled(URLS_TO_CACHE.map(url => cache.add(url)));
      })
  );
});

self.addEventListener('activate', event => {
  // Membersihkan cache lama jika ada versi baru
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Langsung mengambil kontrol klien
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Strategi: Cache-First, Fallback ke Network
  // Pengecualian: Untuk data eksternal (API TFJS atau Copernicus), jika gagal di cache, coba network.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Mengembalikan respons dari cache jika ditemukan
        if (response) {
          return response;
        }

        // Jika tidak ada di cache, ambil dari internet
        return fetch(event.request).then(
          function(networkResponse) {
            // Periksa jika respons valid (bisa jadi error 404, atau opaque dari CDN eksternal)
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Klon respons karena Stream hanya bisa dikonsumsi sekali
            var responseToCache = networkResponse.clone();

            // Simpan file baru ke dalam cache untuk request berikutnya
            if(event.request.method === 'GET' && !event.request.url.includes('copernicus')) {
              caches.open(CACHE_NAME)
                .then(function(cache) {
                  cache.put(event.request, responseToCache);
                });
            }

            return networkResponse;
          }
        ).catch(err => {
          console.warn('[Service Worker] Fetch gagal. Anda dalam mode Offline dan file tidak ada di Cache.', err);
        });
      })
  );
});
