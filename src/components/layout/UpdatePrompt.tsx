import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { registerSW } from 'virtual:pwa-register'
import { toast } from '../../lib/toast'
import { Button } from '../ui/Button'

let updateSW: ((reload?: boolean) => Promise<void>) | null = null

/** ثبت Service Worker و اعلان نسخه جدید پوسته اپ */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        toast('اپ برای استفاده آفلاین آماده است', { tone: 'success' })
      },
      onRegisteredSW(_url, reg) {
        if (!reg) return
        // بررسی دوره‌ای نسخه جدید پوسته
        setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000)
        // درخواست Periodic Background Sync (Chrome/Edge پس از نصب)
        void registerPeriodicSync(reg)
      },
    })
  }, [])

  return (
    <AnimatePresence>
      {needRefresh && (
        <m.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="fixed inset-x-3 top-[calc(var(--safe-top)+10px)] z-[66] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-float"
          role="alert"
        >
          <RefreshCw className="h-5 w-5 shrink-0 text-brand" />
          <p className="flex-1 text-sm">نسخه جدید اپلیکیشن آماده است.</p>
          <Button size="sm" onClick={() => void updateSW?.(true)}>
            بارگذاری
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
            بعداً
          </Button>
        </m.div>
      )}
    </AnimatePresence>
  )
}

async function registerPeriodicSync(reg: ServiceWorkerRegistration) {
  try {
    const anyReg = reg as ServiceWorkerRegistration & { periodicSync?: { register(tag: string, o: { minInterval: number }): Promise<void> } }
    if (!anyReg.periodicSync) return
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName })
    if (status.state !== 'granted') return
    await anyReg.periodicSync.register('lawbook-weekly-update', { minInterval: 7 * 24 * 60 * 60 * 1000 })
  } catch {
    /* پشتیبانی نمی‌شود */
  }
}

/** ثبت Background Sync یک‌باره (مثلاً وقتی کاربر آفلاین «به‌روزرسانی» را زده است) */
export async function requestBackgroundUpdate(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker?.ready
    const anyReg = reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }
    if (anyReg?.sync) {
      await anyReg.sync.register('lawbook-update')
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}
