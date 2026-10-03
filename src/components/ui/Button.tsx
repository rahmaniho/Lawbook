import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { m, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-contrast shadow-soft hover:brightness-110',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3',
  soft: 'bg-brand-soft text-brand-strong hover:brightness-105',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  outline: 'border border-line bg-surface text-fg hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:brightness-105',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-2xl gap-2',
  lg: 'h-13 px-6 text-base rounded-2xl gap-2',
  icon: 'h-11 w-11 rounded-full',
  'icon-sm': 'h-9 w-9 rounded-full',
}

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant
  size?: Size
  hapticFeedback?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', hapticFeedback = true, onClick, type = 'button', ...props },
  ref,
) {
  return (
    <m.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      onClick={(e) => {
        if (hapticFeedback) haptic('light')
        onClick?.(e)
      }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-medium transition-[background-color,filter,color] duration-150 disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})

/** دکمه ساده بدون انیمیشن (برای فهرست‌های بلند) */
export function PlainButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('select-none', className)} {...props} />
}
