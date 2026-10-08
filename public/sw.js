/* eslint-disable no-undef */
/**
 * Service Worker «کتابچه قانون»
 *  - پیش‌بارگذاری پوسته برنامه برای اجرای آفلاین
 *  - کش Stale-While-Revalidate برای پوسته، فونت‌ها و دارایی‌های ایستا
 *  - کش نسخه‌ای (immutable) برای داده‌های قوانین: /data/v/<version>/...
 *  - Background Sync + Periodic Sync برای بررسی به‌روزرسانی قوانین
 *
 * نکتهٔ مهم: برنامه زیر یک زیرمسیر (basePath) سرو می‌شود، بنابراین هیچ مسیری
 * اینجا به‌صورت مطلق از ریشهٔ دامنه نوشته نمی‌شود. basePath در زمان اجرا از خودِ
 * آدرس سرویس‌ورکر استخراج می‌شود تا هم برای استقرار در ریشه و هم زیر /Lawbook
 * درست کار کند.
 */
const VERSION = 'v1';
const SHELL_CACHE = `ghanoun-shell-${VERSION}`;
const ASSET_CACHE = `ghanoun-assets-${VERSION}`;
const DATA_CACHE = `ghanoun-data-${VERSION}`;

/** basePath سرویس‌ورکر: '/Lawbook/sw.js' → '/Lawbook' ؛ '/sw.js' → '' */
const BASE = (() => {
  const p = new URL('./', self.location).pathname.replace(/\/+$/, '');
  return p === '/' ? '' : p;
})();

/** ساختن مسیرِ سازگار با basePath */
const u = (urlPath) => `${BASE}${urlPath}`;

const OFFLINE_URL = u('/offline/');

const SHELL_ROUTES = [
  '/', '/laws/', '/search/', '/bookmarks/', '/settings/', '/about/', '/offline/', '/coverage/',
].map(u);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(SHELL_ROUTES.map((route) => cache.add(new Request(route, { cache: 'reload' }))));
      await cache.add(new Request(u('/manifest.webmanifest'), { cache: 'reload' })).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, ASSET_CACHE, DATA_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable().catch(() => undefined);
      }
      await self.clients.claim();
    })(),
  );
});

function isVersionedData(url) {
  return url.pathname.startsWith(u('/data/v/'));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('<h1>آفلاین</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // خودِ سرویس‌ورکر همیشه از شبکه بررسی شود تا نسخهٔ کهنه قفل نشود
  if (url.pathname === u('/sw.js')) return;

  // داده‌های نسخه‌بندی‌شده قوانین: کش دائمی (تغییرناپذیر)
  if (isVersionedData(url)) {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  // اشاره‌گر نسخه: همیشه از شبکه، با پشتیبان کش
  if (url.pathname === u('/data/version.json')) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(DATA_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cache = await caches.open(DATA_CACHE);
          const cached = await cache.match(request);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  if (
    url.pathname.startsWith(u('/_next/static/')) ||
    url.pathname.startsWith(u('/icons/')) ||
    url.pathname.startsWith(u('/fonts/'))
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith(u('/_next/')) || url.pathname === u('/manifest.webmanifest')) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

/** بررسی به‌روزرسانی نسخه داده در پس‌زمینه و اطلاع به برنامه */
async function checkForDataUpdates() {
  try {
    const res = await fetch(u('/data/version.json'), { cache: 'no-store' });
    if (!res.ok) return;
    const pointer = await res.json();
    const cache = await caches.open(DATA_CACHE);
    await cache.put(u('/data/version.json'), new Response(JSON.stringify(pointer), { headers: { 'Content-Type': 'application/json' } }));
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'data-updated', version: pointer.version }));
  } catch {
    /* آفلاین */
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'ghanoun-sync') event.waitUntil(checkForDataUpdates());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'ghanoun-periodic') event.waitUntil(checkForDataUpdates());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'register-sync') {
    if (self.registration.sync) self.registration.sync.register('ghanoun-sync').catch(() => undefined);
    if (self.registration.periodicSync) {
      self.registration.periodicSync
        .register('ghanoun-periodic', { minInterval: 24 * 60 * 60 * 1000 })
        .catch(() => undefined);
    }
  }
  if (data.type === 'skip-waiting') self.skipWaiting();
  if (data.type === 'check-updates') event.waitUntil(checkForDataUpdates());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(u('/settings/')));
});
