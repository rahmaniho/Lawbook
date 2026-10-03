import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

export function Chip({
  selected,
  onClick,
  children,
  className,
  icon,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        haptic('light')
        onClick?.()
      }}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors active:scale-[0.97]',
        selected ? 'border-transparent bg-brand text-brand-contrast' : 'border-line bg-surface text-fg hover:bg-surface-2',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
