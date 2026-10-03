/// <reference lib="webworker" />
/**
 * Service Worker «کتابچه قانون»
 * - پیش‌کش (precache) پوسته اپ برای اجرای کاملاً آفلاین
 * - محتوای قوانین (/data/*) در Cache Storage با راهبرد Stale-While-Revalidate
 * - manifest داده‌ها با Network-First (تشخیص سریع نسخه جدید، با پشتیبان آفلاین)
 * - Background Sync / Periodic Background Sync برای به‌روزرسانی هفتگی داده‌ها در IndexedDB
 * - Push و اعلان تغییر مواد نشان‌شده
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { bookmarkedAmong, getDatasetMeta, updateDataset } from './lib/data/sync'
import { db } from './lib/db'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] }

const UPDATE_TAG = 'lawbook-update'
const PERIODIC_TAG = 'lawbook-weekly-update'

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// مسیریابی SPA در حالت آفلاین
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/data\//, /^\/api\//, /\.[a-z0-9]+$/i] }))

// فهرست نسخه داده‌ها: اول شبکه (با مهلت)، در غیر این صورت کش
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname === '/data/manifest.json',
  new NetworkFirst({ cacheName: 'law-manifest', networkTimeoutSeconds: 4 }),
)

// محتوای قوانین: Stale-While-Revalidate
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/'),
  new StaleWhileRevalidate({
    cacheName: 'law-data',
    plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 120, purgeOnQuotaError: true })],
  }),
)

// فونت/تصاویر ثانویه
registerRoute(
  ({ request }) => request.destination === 'font' || request.destination === 'image',
  new CacheFirst({ cacheName: 'assets', plugins: [new ExpirationPlugin({ maxEntries: 60, purgeOnQuotaError: true })] }),
)

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
  if (event.data?.type === 'RUN_UPDATE') event.waitUntil(backgroundUpdate())
})

async function notifyClients(message: unknown) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const c of clients) c.postMessage(message)
}

async function backgroundUpdate() {
  try {
    const meta = await getDatasetMeta()
    if (!meta?.complete) return
    const result = await updateDataset()
    if (!result.updated) return
    await notifyClients({ type: 'DATA_UPDATED', result })
    const ids = await bookmarkedAmong(result.changedArticleIds)
    if (ids.length && Notification.permission === 'granted') {
      const arts = (await db.articles.bulkGet(ids)).filter(Boolean)
      await self.registration.showNotification('تغییر در مواد نشان‌شده', {
        body: arts
          .slice(0, 3)
          .map((a) => `${a!.lawTitle} — ${a!.label}`)
          .join('، '),
        icon: '/icons/192.png',
        badge: '/icons/192.png',
        dir: 'rtl',
        lang: 'fa',
        tag: 'bookmark-changes',
        data: { url: '/bookmarks' },
      })
    }
  } catch (e) {
    await notifyClients({ type: 'DATA_UPDATE_FAILED', error: String(e) })
    throw e
  }
}

// Background Sync (یک‌باره) — وقتی کاربر آفلاین درخواست به‌روزرسانی داده است
self.addEventListener('sync', (event: Event) => {
  const e = event as ExtendableEvent & { tag: string }
  if (e.tag === UPDATE_TAG) e.waitUntil(backgroundUpdate())
})

// Periodic Background Sync — بررسی هفتگی (Chrome/Edge، پس از نصب PWA)
self.addEventListener('periodicsync', (event: Event) => {
  const e = event as ExtendableEvent & { tag: string }
  if (e.tag === PERIODIC_TAG) e.waitUntil(backgroundUpdate())
})

// Push: پیام سرور (scripts/admin/push-notify.mjs)
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; type?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    (async () => {
      if (data.type === 'data-update') await backgroundUpdate().catch(() => undefined)
      await self.registration.showNotification(data.title ?? 'کتابچه قانون', {
        body: data.body ?? 'به‌روزرسانی جدید قوانین در دسترس است.',
        icon: '/icons/192.png',
        badge: '/icons/192.png',
        dir: 'rtl',
        lang: 'fa',
        data: { url: data.url ?? '/' },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/'
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of clients) {
        if ('focus' in c) {
          await (c as WindowClient).focus()
          ;(c as WindowClient).navigate(url).catch(() => undefined)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
