import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { BookOpenCheck, Copy, ExternalLink, Filter, Info, Library, Loader2, RefreshCw, Search, Share2, WifiOff, X } from 'lucide-react'
import { AppBar, AppBarAction } from '../components/layout/AppBar'
import { Sheet } from '../components/ui/Sheet'
import { Chip } from '../components/ui/Chip'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Segmented } from '../components/ui/Segmented'
import { Skeleton } from '../components/ui/Skeleton'
import { Highlight } from '../components/search/Highlight'
import { useDebounce } from '../hooks/useDebounce'
import { useOnline } from '../hooks/useOnline'
import { useCatalogMeta } from '../hooks/useLaws'
import { useSettings } from '../lib/settings'
import { normalizeSearch, searchTerms, toFaDigits, toLatinDigits } from '../lib/normalize'
import { copyText } from '../lib/share'
import { toast } from '../lib/toast'
import { cn, lawPath } from '../lib/utils'
import { Q_TYPES, qavaninUrl, qTypeInfo, type QIndexManifest, type QType } from '../lib/qindex/model'
import {
  cancelQIndexRelease,
  fetchQIndexManifest,
  loadQIndex,
  scheduleQIndexRelease,
  searchQIndex,
  useQIndexStatus,
  type QEntryOut,
  type QSearchParams,
  type QSearchResponse,
} from '../lib/qindex/client'

const PAGE = 60
type Sort = NonNullable<QSearchParams['sort']>

const mb = (bytes: number) => toFaDigits((bytes / 1024 / 1024).toFixed(1))

export default function EnactmentsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = (params.get('t') as QType | null) || undefined
  const authority = params.get('a') ?? ''
  const yearFrom = Number(params.get('from')) || undefined
  const yearTo = Number(params.get('to')) || undefined
  const sortParam = (params.get('sort') as Sort | null) || undefined
  const sort: Sort = sortParam ?? (q.trim() ? 'relevance' : 'newest')

  const [input, setInput] = useState(q)
  const debounced = useDebounce(input, 200)
  const status = useQIndexStatus()
  const catalog = useCatalogMeta()
  const online = useOnline()
  const settings = useSettings()
  const persian = settings.persianDigits
  const [manifest, setManifest] = useState<QIndexManifest | null>(null)
  const [res, setRes] = useState<QSearchResponse | null>(null)
  const [items, setItems] = useState<QEntryOut[]>([])
  const [more, setMore] = useState(false)
  const [selected, setSelected] = useState<QEntryOut | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const summary = catalog?.qindex

  const update = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === 0) next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    cancelQIndexRelease()
    void fetchQIndexManifest().then(setManifest)
    return () => scheduleQIndexRelease()
  }, [])

  useEffect(() => {
    void loadQIndex().catch(() => undefined)
  }, [attempt])

  useEffect(() => {
    if (debounced.trim() !== q.trim()) update({ q: debounced.trim() || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  useEffect(() => {
    let alive = true
    const query: QSearchParams = { q, types: type ? [type] : undefined, authority: authority || undefined, yearFrom, yearTo, sort, offset: 0, limit: PAGE }
    searchQIndex(query)
      .then((r) => {
        if (!alive) return
        setRes(r)
        setItems(r.items)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [q, type, authority, yearFrom, yearTo, sort, attempt])

  const loadMore = () => {
    if (!res || more || items.length >= res.total) return
    setMore(true)
    searchQIndex({ q, types: type ? [type] : undefined, authority: authority || undefined, yearFrom, yearTo, sort, offset: items.length, limit: PAGE })
      .then((r) => setItems((prev) => [...prev, ...r.items]))
      .finally(() => setMore(false))
  }

  const terms = useMemo(() => searchTerms(q), [q])

  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setScrollMargin(listRef.current ? listRef.current.getBoundingClientRect().top + window.scrollY : 0)
    measure()
    const ro = new ResizeObserver(measure)
    if (listRef.current?.parentElement) ro.observe(listRef.current.parentElement)
    return () => ro.disconnect()
  }, [res])

  const virtualizer = useWindowVirtualizer({ count: items.length, estimateSize: () => 92, overscan: 10, scrollMargin })
  const virtualItems = virtualizer.getVirtualItems()
  const lastIndex = virtualItems.at(-1)?.index ?? 0
  useEffect(() => {
    if (items.length && lastIndex >= items.length - 8) loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastIndex, items.length])

  const total = summary?.count ?? manifest?.count
  const latest = summary?.latestDate ?? manifest?.latestDate
  const filterCount = (authority ? 1 : 0) + (yearFrom ? 1 : 0) + (yearTo ? 1 : 0) + (sortParam ? 1 : 0)
  const loading = status.state === 'download' || status.state === 'prepare' || status.state === 'idle'
  const d = (s: string | number) => (persian ? toFaDigits(s) : String(s))

  return (
    <div className="pb-2">
      <AppBar
        back="/laws"
        title="فهرست مصوبات"
        subtitle={total ? `${toFaDigits(total.toLocaleString('fa-IR'))} عنوان سامانه ملی قوانین • ۱۲۸۵ تا ${toFaDigits((latest ?? '').slice(0, 4))}` : 'سامانه ملی قوانین و مقررات'}
        actions={
          <AppBarAction label="فیلترها" onClick={() => setFiltersOpen(true)} active={filterCount > 0}>
            <Filter className="h-5.5 w-5.5" />
          </AppBarAction>
        }
      >
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 shadow-soft focus-within:border-brand">
          <Search className="h-5 w-5 shrink-0 text-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="جستجو در عنوان ۱۵۰ هزار مصوبه…"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            enterKeyHint="search"
            aria-label="جستجو در عنوان مصوبات"
          />
          {input && (
            <button type="button" onClick={() => setInput('')} aria-label="پاک کردن" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2">
              <X className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      </AppBar>

      <main className="mx-auto max-w-3xl px-4 pt-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="نوع مصوبه">
          <Chip selected={!type} onClick={() => update({ t: undefined })}>
            همه{res ? ` (${toFaDigits(Object.values(res.byType).reduce((s, n) => s + (n ?? 0), 0).toLocaleString('fa-IR'))})` : ''}
          </Chip>
          {Q_TYPES.map((t) => {
            const n = res?.byType[t.id]
            if (res && !n && type !== t.id) return null
            return (
              <Chip key={t.id} selected={type === t.id} onClick={() => update({ t: type === t.id ? undefined : t.id })}>
                {t.short}
                {n ? ` (${toFaDigits(n.toLocaleString('fa-IR'))})` : ''}
              </Chip>
            )
          })}
        </div>

        {(authority || yearFrom || yearTo) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {authority && (
              <button type="button" onClick={() => update({ a: undefined })} className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-[12.5px] text-brand-strong">
                مرجع: {authority} <X className="h-3.5 w-3.5" />
              </button>
            )}
            {(yearFrom || yearTo) && (
              <button
                type="button"
                onClick={() => update({ from: undefined, to: undefined })}
                className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-[12.5px] text-brand-strong"
              >
                سال {yearFrom ? toFaDigits(yearFrom) : '…'} تا {yearTo ? toFaDigits(yearTo) : '…'} <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {status.state === 'error' ? (
          <EmptyState
            icon={online ? <Info className="h-7 w-7" /> : <WifiOff className="h-7 w-7" />}
            title="دریافت فهرست مصوبات ممکن نشد"
            description={
              online
                ? status.error
                : 'فهرست هنوز روی این دستگاه ذخیره نشده است. پس از اتصال به اینترنت یک بار این صفحه را باز کنید یا از «تنظیمات» آن را برای استفاده آفلاین دریافت کنید.'
            }
            action={
              <Button variant="soft" onClick={() => setAttempt((a) => a + 1)}>
                <RefreshCw className="h-4 w-4" /> تلاش دوباره
              </Button>
            }
          />
        ) : loading && !res ? (
          // min-h-lvh: جای فهرست پیش از دریافت رزرو می‌شود تا بخش توضیح پایین صفحه جابه‌جا نشود (CLS)
          <div className="min-h-lvh">
            <LoadingCard status={status} />
          </div>
        ) : !res ? (
          <div className="min-h-lvh" aria-hidden="true" />
        ) : (
          <>
            <p className="mb-2 mt-3 flex items-center justify-between gap-2 text-[12.5px] text-muted" aria-live="polite">
              <span>
                {res ? `${toFaDigits(res.total.toLocaleString('fa-IR'))} مصوبه` : '…'}
                {res && q ? ` برای «${q}»` : ''}
              </span>
              {res && <span>{toFaDigits(res.tookMs)} میلی‌ثانیه</span>}
            </p>
            <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualItems.map((vi) => {
                const item = items[vi.index]
                return (
                  <div
                    key={vi.key}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className="absolute inset-x-0 top-0 pb-2"
                    style={{ transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)` }}
                  >
                    <EntryRow item={item} terms={terms} persian={persian} onOpen={() => setSelected(item)} />
                  </div>
                )
              })}
            </div>
            {more && (
              <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری…
              </p>
            )}
            {res && !res.total && (
              <EmptyState icon={<Search className="h-7 w-7" />} title="عنوانی یافت نشد" description="واژه کوتاه‌تر یا املای دیگری را امتحان کنید (مثلاً «مالیات» به‌جای «مالیاتهای مستقیم»)." />
            )}
          </>
        )}

        <section className="mt-5 rounded-2xl border border-line bg-surface p-3.5 text-[12.5px] leading-6 text-muted">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>
              این فهرست <b className="text-fg">عنوان و مشخصات</b> مصوبات ثبت‌شده در سامانه ملی قوانین و مقررات است (آخرین مصوبه فهرست:{' '}
              {latest ? toFaDigits(latest) : '—'}). متن کامل {toFaDigits(Object.keys(manifest?.inApp ?? {}).length || 19)} قانون اصلی در اپ موجود است (نشان «متن
              کامل»)؛ متن رسمی بقیه موارد و وضعیت اعتبار آن‌ها را در سامانه ملی قوانین ببینید.
            </span>
          </p>
        </section>
      </main>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title="مشخصات مصوبه">
        {selected && <EntryDetails entry={selected} online={online} d={d} />}
      </Sheet>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="فیلتر و مرتب‌سازی">
        <Filters
          manifest={manifest}
          authority={authority}
          yearFrom={yearFrom}
          yearTo={yearTo}
          sort={sort}
          hasQuery={!!q.trim()}
          onApply={(patch) => {
            update(patch)
            setFiltersOpen(false)
          }}
        />
      </Sheet>
    </div>
  )
}

function LoadingCard({ status }: { status: ReturnType<typeof useQIndexStatus> }) {
  const pct = status.totalBytes ? Math.round(((status.bytes ?? 0) / status.totalBytes) * 100) : 0
  return (
    <section className="mt-4 rounded-card border border-line bg-surface p-4 shadow-soft" aria-live="polite">
      <p className="flex items-center gap-2 font-bold">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
        {status.state === 'prepare' ? 'در حال آماده‌سازی جستجو…' : 'در حال دریافت فهرست مصوبات…'}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${status.state === 'prepare' ? 100 : pct}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        {status.totalBytes
          ? `${toFaDigits(status.loaded ?? 0)} از ${toFaDigits(status.total ?? 0)} بسته • ${mb(status.bytes ?? 0)} از ${mb(status.totalBytes)} مگابایت`
          : 'دریافت فهرست…'}{' '}
        — پس از نخستین دریافت، فهرست بدون اینترنت هم در دسترس است.
      </p>
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-2xl" />
        ))}
      </div>
    </section>
  )
}

function EntryRow({ item, terms, persian, onOpen }: { item: QEntryOut; terms: string[]; persian: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-start shadow-soft active:scale-[0.99]">
      <span className="block text-[14.5px] font-semibold leading-7">
        <Highlight text={item.title} terms={terms} persian={persian} />
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        <span>{persian ? toFaDigits(item.date || '—') : item.date || '—'}</span>
        <span aria-hidden="true">•</span>
        <span className="min-w-0 truncate">{item.authority || 'مرجع نامشخص'}</span>
        <Badge className="!py-0 !text-[11px]">{qTypeInfo(item.type).short}</Badge>
        {item.lawId && (
          <Badge tone="ok" className="!py-0 !text-[11px]">
            <BookOpenCheck className="h-3 w-3" /> متن کامل در اپ
          </Badge>
        )}
      </span>
    </button>
  )
}

function EntryDetails({ entry, online, d }: { entry: QEntryOut; online: boolean; d: (s: string | number) => string }) {
  const url = qavaninUrl(entry.id)
  const share = async () => {
    const text = `${entry.title}\nمصوب ${d(entry.date)} — ${entry.authority}\n${url}`
    if (navigator.share) {
      try {
        await navigator.share({ title: entry.title, text })
        return
      } catch {
        return
      }
    }
    if (await copyText(text)) toast('مشخصات مصوبه کپی شد')
  }
  return (
    <div className="space-y-4 text-[14px] leading-7">
      <h3 className="text-[16px] font-extrabold leading-8">{d(entry.title)}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-muted">تاریخ تصویب</dt>
        <dd>{entry.date ? d(entry.date) : '—'}</dd>
        <dt className="text-muted">مرجع تصویب</dt>
        <dd>{entry.authority || '—'}</dd>
        <dt className="text-muted">نوع</dt>
        <dd>{qTypeInfo(entry.type).title}</dd>
        <dt className="text-muted">شناسه سامانه</dt>
        <dd>{d(entry.id)}</dd>
      </dl>
      {entry.lawId && (
        <Link to={lawPath(entry.lawId)} className="flex items-center justify-between rounded-2xl bg-brand px-4 py-3 font-bold text-brand-contrast">
          <span className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5" /> متن کامل در کتابچه قانون (آفلاین)
          </span>
        </Link>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener"
        aria-disabled={!online}
        className={cn(
          'flex items-center justify-between rounded-2xl border border-line px-4 py-3 font-semibold',
          entry.lawId ? 'bg-surface' : 'bg-brand-soft text-brand-strong',
          !online && 'pointer-events-none opacity-60',
        )}
      >
        <span className="flex items-center gap-2">
          <Library className="h-5 w-5" /> متن رسمی در سامانه ملی قوانین
        </span>
        <ExternalLink className="h-4 w-4" />
      </a>
      {!online && <p className="text-[12.5px] text-muted">برای مشاهده متن رسمی به اینترنت نیاز است.</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={async () => {
            if (await copyText(entry.title)) toast('عنوان کپی شد')
          }}
        >
          <Copy className="h-4 w-4" /> کپی عنوان
        </Button>
        <Button variant="secondary" className="flex-1" onClick={share}>
          <Share2 className="h-4 w-4" /> اشتراک‌گذاری
        </Button>
      </div>
      <p className="rounded-xl bg-surface-2 p-3 text-[12.5px] leading-6 text-muted">
        عنوان، تاریخ و مرجع تصویب عیناً از فهرست سامانه ملی قوانین است. وضعیت اعتبار (معتبر، اصلاحی یا منسوخ) و متن رسمی را در سامانه بررسی کنید.
      </p>
    </div>
  )
}

function Filters({
  manifest,
  authority,
  yearFrom,
  yearTo,
  sort,
  hasQuery,
  onApply,
}: {
  manifest: QIndexManifest | null
  authority: string
  yearFrom?: number
  yearTo?: number
  sort: Sort
  hasQuery: boolean
  onApply: (patch: Record<string, string | number | undefined>) => void
}) {
  const [a, setA] = useState(authority)
  const [from, setFrom] = useState(yearFrom ? toFaDigits(yearFrom) : '')
  const [to, setTo] = useState(yearTo ? toFaDigits(yearTo) : '')
  const [s, setS] = useState<Sort>(sort)
  const [filter, setFilter] = useState('')
  const authorities = useMemo(() => {
    if (!manifest) return []
    const list = manifest.authorities.map((name, i) => ({ name, count: manifest.authorityCounts[i] })).filter((x) => x.name)
    const f = normalizeSearch(filter)
    return (f ? list.filter((x) => normalizeSearch(x.name).includes(f)) : list).slice(0, f ? 40 : 18)
  }, [manifest, filter])
  const year = (v: string) => {
    const n = Number(toLatinDigits(v.trim()))
    return n >= 1280 && n <= 1500 ? n : undefined
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[13px] font-bold">مرتب‌سازی</p>
        <Segmented
          value={s}
          onChange={setS}
          options={[...(hasQuery ? [{ value: 'relevance' as Sort, label: 'مرتبط‌ترین' }] : []), { value: 'newest', label: 'جدیدترین' }, { value: 'oldest', label: 'قدیمی‌ترین' }]}
        />
      </div>
      <div>
        <p className="mb-2 text-[13px] font-bold">سال تصویب</p>
        <div className="flex items-center gap-2">
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            inputMode="numeric"
            placeholder="از (مثلاً ۱۳۵۸)"
            className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 text-[15px] outline-none focus:border-brand"
            aria-label="از سال"
          />
          <span className="text-muted">تا</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            inputMode="numeric"
            placeholder="تا (مثلاً ۱۴۰۱)"
            className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 text-[15px] outline-none focus:border-brand"
            aria-label="تا سال"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-bold">مرجع تصویب</p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="جستجوی مرجع (مثلاً دیوان، مجلس، هیئت وزیران)…"
          className="mb-2 h-11 w-full rounded-2xl border border-line bg-surface px-3 text-[14px] outline-none focus:border-brand"
          aria-label="جستجوی مرجع تصویب"
        />
        <div className="flex flex-wrap gap-1.5">
          <Chip selected={!a} onClick={() => setA('')}>
            همه مراجع
          </Chip>
          {authorities.map((x) => (
            <Chip key={x.name} selected={a === x.name} onClick={() => setA(a === x.name ? '' : x.name)} className="!h-auto min-h-9 py-1 text-start">
              {x.name} <span className="text-[11px] opacity-70">({toFaDigits(x.count.toLocaleString('fa-IR'))})</span>
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() =>
            onApply({ a: a || undefined, from: year(from), to: year(to), sort: s === (hasQuery ? 'relevance' : 'newest') ? undefined : s })
          }
        >
          اعمال
        </Button>
        <Button variant="secondary" onClick={() => onApply({ a: undefined, from: undefined, to: undefined, sort: undefined })}>
          حذف فیلترها
        </Button>
      </div>
    </div>
  )
}
