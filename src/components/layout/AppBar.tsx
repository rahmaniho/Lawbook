import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

/**
 * نوار بالای صفحه (Sticky). در صفحات داخلی دکمه بازگشت نمایش داده می‌شود.
 */
export function AppBar({
  title,
  subtitle,
  back,
  actions,
  children,
  className,
  transparent,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  back?: boolean | string
  actions?: ReactNode
  children?: ReactNode
  className?: string
  transparent?: boolean
}) {
  const navigate = useNavigate()
  const goBack = () => {
    haptic('light')
    if (typeof back === 'string') navigate(back)
    else if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/')
  }
  return (
    <header
      className={cn(
        'sticky top-0 z-40 pt-safe',
        transparent ? 'bg-transparent' : 'border-b border-line/70 bg-bg/85 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/75',
        className,
      )}
    >
      {(title || back || actions) && (
        <div className="mx-auto flex h-[var(--appbar-h)] max-w-3xl items-center gap-1 px-2">
          {back && (
            <button
              type="button"
              onClick={goBack}
              aria-label="بازگشت"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2 active:scale-95"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          )}
          <div className={cn('min-w-0 flex-1', !back && 'ps-3')}>
            {title && <h1 className="truncate text-[17px] font-bold leading-6">{title}</h1>}
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
        </div>
      )}
      {children && <div className="mx-auto max-w-3xl px-4 pb-3">{children}</div>}
    </header>
  )
}

export function AppBarAction({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        haptic('light')
        onClick()
      }}
      className={cn(
        'grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-surface-2 active:scale-95',
        active ? 'text-brand' : 'text-fg',
      )}
    >
      {children}
    </button>
  )
}
