import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, CloudDownload, Library, Loader2, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { useCatalogMeta } from '../../hooks/useLaws'
import { clearQIndexOffline, loadQIndex, qindexOfflineState, releaseQIndex, useQIndexStatus } from '../../lib/qindex/client'
import { toFaDigits } from '../../lib/normalize'
import { toast } from '../../lib/toast'

const mb = (b: number) => toFaDigits((b / 1024 / 1024).toFixed(1))

/** «فهرست مصوبات» برای استفاده آفلاین (بسته‌ها در Cache Storage) */
export function QIndexOfflineRow() {
  const catalog = useCatalogMeta()
  const status = useQIndexStatus()
  const [state, setState] = useState<{ cached: number; total: number; bytes: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const summary = catalog?.qindex

  const refresh = useCallback(() => {
    void qindexOfflineState().then(setState)
  }, [])
  useEffect(refresh, [refresh])

  const complete = !!state && state.total > 0 && state.cached === state.total
  const downloading = busy && (status.state === 'download' || status.state === 'prepare')

  return (
    <div className="px-4 py-3.5">
      <p className="flex items-center gap-2 text-[14.5px] font-medium">
        <Library className="h-4 w-4" /> فهرست مصوبات سامانه ملی قوانین
      </p>
      <p className="mt-0.5 text-[12px] leading-5 text-muted">
        {summary ? `${toFaDigits(summary.count.toLocaleString('fa-IR'))} عنوان • حداکثر ${mb(summary.transferBytes ?? summary.bytes)} مگابایت دریافت` : 'عناوین قوانین، مقررات، آرا و نظریات'}
        {state && ` • ${complete ? 'ذخیره‌شده روی دستگاه' : state.cached ? `${toFaDigits(state.cached)} از ${toFaDigits(state.total)} بسته ذخیره شده` : 'هنوز ذخیره نشده'}`}
      </p>
      {downloading && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${status.state === 'prepare' ? 100 : status.totalBytes ? Math.round(((status.bytes ?? 0) / status.totalBytes) * 100) : 5}%` }}
          />
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {complete ? (
          <span className="flex items-center gap-1.5 text-[13px] text-ok">
            <CheckCircle2 className="h-4 w-4" /> آماده استفاده آفلاین
          </span>
        ) : (
          <Button
            variant="soft"
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (!navigator.onLine) {
                toast('برای دریافت فهرست به اینترنت نیاز است.', { tone: 'error' })
                return
              }
              setBusy(true)
              try {
                await loadQIndex()
                toast('فهرست مصوبات برای استفاده آفلاین ذخیره شد.')
              } catch {
                toast('دریافت فهرست ناموفق بود؛ دوباره تلاش کنید.', { tone: 'error' })
              } finally {
                setBusy(false)
                releaseQIndex()
                refresh()
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />} دریافت برای استفاده آفلاین
          </Button>
        )}
        <Link to="/enactments" className="flex h-9 items-center rounded-xl px-3 text-[13px] font-medium text-brand-strong">
          باز کردن فهرست
        </Link>
        {!!state?.cached && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await clearQIndexOffline()
              toast('فهرست مصوبات از حافظه دستگاه حذف شد.')
              refresh()
            }}
          >
            <Trash2 className="h-4 w-4 text-danger" /> حذف از دستگاه
          </Button>
        )}
      </div>
    </div>
  )
}
