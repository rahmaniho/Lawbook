import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Tone = 'default' | 'brand' | 'accent' | 'danger' | 'ok' | 'outline'
const tones: Record<Tone, string> = {
  default: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand-strong',
  accent: 'bg-accent-soft text-accent',
  danger: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
  outline: 'border border-line text-muted',
}

export function Badge({ className, tone = 'default', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5', tones[tone], className)}
      {...props}
    />
  )
}
