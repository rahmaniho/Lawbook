import type { ArticleStatus } from '../../lib/types'
import { Badge } from '../ui/Badge'

export function StatusBadge({ status, className }: { status: ArticleStatus | string; className?: string }) {
  if (status === 'منسوخ')
    return (
      <Badge tone="danger" className={className}>
        منسوخ
      </Badge>
    )
  if (status === 'اصلاحی')
    return (
      <Badge tone="accent" className={className}>
        اصلاحی
      </Badge>
    )
  return (
    <Badge tone="ok" className={className}>
      لازم‌الاجرا
    </Badge>
  )
}
