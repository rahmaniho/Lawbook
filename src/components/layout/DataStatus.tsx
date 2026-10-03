import { CheckCircle2, CloudDownload, RefreshCw, WifiOff, AlertTriangle } from 'lucide-react'
import { m } from 'framer-motion'
import { useDataState, retryInstall } from '../../lib/data/store'
import { useSearchStatus } from '../../lib/search/client'
import { formatBytes } from '../../lib/format'
import { toFaDigits } from '../../lib/normalize'
import { Button } from '../ui/Button'

/** کارت وضعیت داده‌ها: نصب اولیه، آمادگی آفلاین، خطا */
export function DataStatus() {
  const data = useDataState()
  const search = useSearchStatus()

  if (data.state === 'installing' || data.state === 'checking' || data.state === 'updating') {
    const p = data.progress
    const pct = p && p.totalBytes ? Math.round((p.bytes / p.totalBytes) * 100) : p && p.total ? Math.round((p.loaded / p.total) * 100) : 4
    return (
      <div className="h-[104px] rounded-card border border-line bg-surface p-4 shadow-soft" role="status" aria-live="polite">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
            <CloudDownload className="h-5 w-5 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{data.state === 'updating' ? 'در حال به‌روزرسانی قوانین…' : 'در حال آماده‌سازی قوانین برای استفاده آفلاین…'}</p>
            <p className="text-[12.5px] text-muted">
              {p?.phase === 'chunks' && p.total
                ? `بسته ${toFaDigits(p.loaded)} از ${toFaDigits(p.total)} — ${formatBytes(p.bytes)} از ${formatBytes(p.totalBytes)}`
                : 'دریافت فهرست قوانین…'}
            </p>
          </div>
          <span className="text-sm font-bold text-brand-strong">{toFaDigits(pct)}٪</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <m.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} />
        </div>
      </div>
    )
  }

  if (data.state === 'offline')
    return (
      <div className="flex min-h-[104px] items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-soft">
        <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="text-sm leading-7">
          <p className="font-bold">برای نخستین استفاده به اینترنت نیاز است</p>
          <p className="text-muted">پس از اولین دریافت (حدود ۴ مگابایت)، همه قوانین بدون اینترنت در دسترس خواهند بود.</p>
        </div>
      </div>
    )

  if (data.state === 'error')
    return (
      <div className="min-h-[104px] rounded-card border border-danger/30 bg-danger-soft p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="flex-1 text-sm leading-7">
            <p className="font-bold">دریافت داده‌ها ناموفق بود</p>
            <p className="text-muted">{data.error}</p>
          </div>
        </div>
        <Button className="mt-3 w-full" variant="outline" onClick={() => void retryInstall()}>
          <RefreshCw className="h-4 w-4" /> تلاش دوباره
        </Button>
      </div>
    )

  const meta = data.meta
  return (
    <div className="h-[104px] rounded-card border border-ok/25 bg-ok-soft/60 p-4" role="status">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface text-ok">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">آماده استفاده آفلاین</p>
          <p className="truncate text-[12.5px] text-muted">
            {toFaDigits((meta?.articleCount ?? 0).toLocaleString('fa-IR'))} ماده • نسخه داده {toFaDigits(meta?.version ?? '')}
            {search.state === 'building' ? ' • ساخت ایندکس جستجو…' : search.state === 'ready' ? ' • جستجو آماده' : ''}
          </p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full w-full rounded-full bg-ok/70" />
      </div>
    </div>
  )
}
