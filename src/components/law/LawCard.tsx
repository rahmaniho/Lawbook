import { Link } from 'react-router'
import { ChevronLeft, Clock3, FileText } from 'lucide-react'
import type { Law } from '../../lib/types'
import { toFaDigits } from '../../lib/normalize'
import { cn, lawPath } from '../../lib/utils'
import { Badge } from '../ui/Badge'

export function LawCard({ law, compact, className }: { law: Law; compact?: boolean; className?: string }) {
  const date = law.approval?.date ?? (law.approval?.year ? String(law.approval.year) : undefined)
  return (
    <Link
      to={lawPath(law.id)}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-soft transition-transform active:scale-[0.985]',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
          law.available ? 'bg-brand-soft text-brand-strong' : 'bg-surface-2 text-muted',
        )}
      >
        {law.available ? <FileText className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-bold leading-6', compact ? 'truncate text-[14.5px]' : 'line-clamp-2 text-[15px]')}>{law.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          {date && <span>مصوب {toFaDigits(date)}</span>}
          {law.available ? (
            <span>
              {toFaDigits(law.stats.articles)} {law.unit}
            </span>
          ) : (
            <>
              <Badge tone={law.seeAlso ? 'ok' : 'outline'} className="py-0 text-[11px]">
                {law.seeAlso ? 'متن در قانون دیگر' : law.kind === 'info' ? 'توضیحی' : 'در انتظار ورود متن'}
              </Badge>
              {law.source?.officialUrl && !law.seeAlso && <span className="text-[11px]">پیوند متن رسمی</span>}
            </>
          )}
        </span>
      </span>
      <ChevronLeft className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:-translate-x-0.5" />
    </Link>
  )
}
