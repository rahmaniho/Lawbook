import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

/**
 * کنترل چندگزینه‌ای (تب‌های هم‌عرض).
 * نشانگر گزینه فعال فقط با transform در CSS جابه‌جا می‌شود؛ انیمیشن layoutId در framer-motion
 * هنگام نخستین نمایش کل صفحه را اندازه‌گیری می‌کرد و وظیفه بلند روی رشته اصلی می‌ساخت.
 * اپ همیشه راست‌به‌چپ است: گزینه نخست در سمت راست و جابه‌جایی به سمت چپ (منفی) است.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
}) {
  const index = options.findIndex((o) => o.value === value)
  return (
    <div role="tablist" className={cn('relative flex rounded-2xl bg-surface-2 p-1', className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 start-1 rounded-xl bg-surface shadow-soft transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.9,.3,1.1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${Math.max(0, index) * -100}%)`,
          opacity: index < 0 ? 0 : 1,
        }}
      />
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
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
