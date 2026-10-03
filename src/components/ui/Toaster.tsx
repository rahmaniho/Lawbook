import { AnimatePresence, m } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { dismissToast, useToasts } from '../../lib/toast'
import { cn } from '../../lib/utils'

export function Toaster() {
  const toasts = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+var(--safe-bottom)+12px)] z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <m.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-float',
              'bg-[#10201d] text-white dark:bg-[#e4eeec] dark:text-[#0a1412]',
            )}
            onClick={() => dismissToast(t.id)}
            role="status"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 dark:text-emerald-700" />
            ) : t.tone === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400 dark:text-red-700" />
            ) : (
              <Info className="h-5 w-5 shrink-0 opacity-70" />
            )}
            <span className="flex-1 leading-6">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 font-bold text-teal-300 dark:text-teal-800"
                onClick={(e) => {
                  e.stopPropagation()
                  t.action!.onClick()
                  dismissToast(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
