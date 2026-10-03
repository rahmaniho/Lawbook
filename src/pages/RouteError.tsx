import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError, Link } from 'react-router'
import { dismissSplash } from '../lib/splash'

export function RouteError() {
  const err = useRouteError()
  useEffect(() => dismissSplash(0), [])
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'خطای نامشخص'
  const chunkError = /dynamically imported module|Failed to fetch|Loading chunk/i.test(msg)
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold">مشکلی پیش آمد</h1>
      <p className="text-sm leading-7 text-muted">
        {chunkError ? 'بخشی از برنامه بارگذاری نشد؛ احتمالاً نسخه جدیدی منتشر شده یا اتصال قطع است.' : msg}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => location.reload()} className="rounded-2xl bg-brand px-5 py-2.5 font-medium text-brand-contrast">
          بارگذاری مجدد
        </button>
        <Link to="/" className="rounded-2xl bg-surface-2 px-5 py-2.5 font-medium">
          صفحه اصلی
        </Link>
      </div>
    </div>
  )
}
