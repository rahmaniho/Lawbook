import { useEffect, useRef } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useOnline } from '../../hooks/useOnline'
import { toast } from '../../lib/toast'

export function OfflineIndicator() {
  const online = useOnline()
  const was = useRef(online)
  useEffect(() => {
    if (!was.current && online) toast('دوباره آنلاین شدید', { tone: 'success' })
    was.current = online
  }, [online])
  return (
    <AnimatePresence>
      {!online && (
        <m.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+var(--safe-bottom)+10px)] z-[54] flex justify-center"
          role="status"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-[#3b2a12] px-3 py-1.5 text-xs font-medium text-amber-100 shadow-float dark:bg-amber-200 dark:text-amber-950">
            <WifiOff className="h-3.5 w-3.5" /> آفلاین — نمایش از داده‌های ذخیره‌شده
          </span>
        </m.div>
      )}
    </AnimatePresence>
  )
}
