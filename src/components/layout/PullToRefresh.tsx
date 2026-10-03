import { useEffect, useRef, useState, type ReactNode } from 'react'
import { m, useMotionValue, useTransform, animate } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { haptic } from '../../lib/haptics'

const THRESHOLD = 76
const MAX = 120

/** کشیدن به پایین برای به‌روزرسانی (روی اسکرول سند) */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const y = useMotionValue(0)
  const rotate = useTransform(y, [0, MAX], [0, 300])
  const opacity = useTransform(y, [0, 30, THRESHOLD], [0, 0.5, 1])
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<number | null>(null)
  const armed = useRef(false)

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1) return
      const target = e.target as HTMLElement
      if (target.closest('[data-no-ptr]')) return
      start.current = e.touches[0].clientY
      armed.current = false
    }
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return
      const dy = e.touches[0].clientY - start.current
      if (dy <= 0 || window.scrollY > 0) {
        y.set(0)
        return
      }
      const v = Math.min(MAX, dy * 0.5)
      y.set(v)
      if (v >= THRESHOLD && !armed.current) {
        armed.current = true
        haptic('medium')
      } else if (v < THRESHOLD && armed.current) armed.current = false
    }
    const onEnd = async () => {
      if (start.current === null) return
      start.current = null
      if (y.get() >= THRESHOLD) {
        setRefreshing(true)
        animate(y, 56, { type: 'spring', stiffness: 400, damping: 30 })
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
          animate(y, 0, { type: 'spring', stiffness: 400, damping: 34 })
        }
      } else animate(y, 0, { type: 'spring', stiffness: 400, damping: 34 })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [onRefresh, refreshing, y])

  return (
    <div className="relative">
      <m.div style={{ height: y }} className="flex items-end justify-center overflow-hidden" aria-hidden={!refreshing}>
        <m.div style={{ opacity }} className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-surface shadow-float">
          <m.span style={{ rotate }} className={refreshing ? 'animate-spin' : ''}>
            <RefreshCw className="h-5 w-5 text-brand" />
          </m.span>
        </m.div>
      </m.div>
      {children}
    </div>
  )
}
