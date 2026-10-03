import { m } from 'framer-motion'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  layoutId,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
  layoutId: string
}) {
  return (
    <div role="tablist" className={cn('flex rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => {
              haptic('light')
              onChange(o.value)
            }}
            className={cn('relative h-9 flex-1 rounded-xl text-[13.5px] font-medium transition-colors', active ? 'text-fg' : 'text-muted')}
          >
            {active && (
              <m.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-surface shadow-soft" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
