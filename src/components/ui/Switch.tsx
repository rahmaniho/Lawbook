import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic('light')
        onChange(!checked)
      }}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-surface-3')}
    >
      <span
        className={cn(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-[inset-inline-start] duration-200',
          checked ? 'start-[calc(100%-1.625rem)]' : 'start-0.5',
        )}
      />
    </button>
  )
}
