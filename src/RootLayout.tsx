import { useEffect } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { AnimatePresence, LazyMotion, m } from 'framer-motion'
import { BottomNav } from './components/layout/BottomNav'
import { OfflineIndicator } from './components/layout/OfflineIndicator'
import { InstallBanner } from './components/layout/InstallBanner'
import { UpdatePrompt } from './components/layout/UpdatePrompt'
import { Toaster } from './components/ui/Toaster'
import { startData, refreshData } from './lib/data/store'
import { resetSearch } from './lib/search/client'
import { useUi } from './lib/ui'

const loadFeatures = () => import('./lib/motion-features').then((r) => r.default)

export function RootLayout() {
  const { immersive } = useUi()

  useEffect(() => {
    void startData()
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'DATA_UPDATED') {
        void refreshData({ silent: true }).then(() => resetSearch())
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [])

  return (
    <LazyMotion features={loadFeatures} strict>
      <div className="min-h-dvh">
        <Outlet />
      </div>
      <AnimatePresence>
        {!immersive && (
          <m.div key="nav" initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ type: 'spring', stiffness: 420, damping: 38 }}>
            <BottomNav />
          </m.div>
        )}
      </AnimatePresence>
      <OfflineIndicator />
      <InstallBanner />
      <UpdatePrompt />
      <Toaster />
      <ScrollRestoration />
    </LazyMotion>
  )
}
