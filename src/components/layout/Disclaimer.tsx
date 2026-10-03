import { ShieldAlert } from 'lucide-react'
import { DISCLAIMER } from '../../lib/share'
import { cn } from '../../lib/utils'

export function Disclaimer({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-2xl border border-accent/25 bg-accent-soft/60 p-3.5 text-[13px] leading-6', className)} role="note">
      <ShieldAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent" />
      <p>
        <b>{DISCLAIMER}.</b>
        {!compact && <> برای استناد رسمی، متن را با روزنامه رسمی کشور (rrk.ir) یا سامانه ملی قوانین و مقررات (qavanin.ir) تطبیق دهید.</>}
      </p>
    </div>
  )
}
