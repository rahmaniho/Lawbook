import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Filter, History, Library, Loader2, Search, Sparkles, Trash2, X, Zap, Hash, Quote } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { ArticleCard } from '../components/law/ArticleCard'
import { Sheet } from '../components/ui/Sheet'
import { Chip } from '../components/ui/Chip'
import { Button } from '../components/ui/Button'
import { Switch } from '../components/ui/Switch'
import { EmptyState } from '../components/ui/EmptyState'
import { ArticleSkeleton } from '../components/ui/Skeleton'
import { useDebounce } from '../hooks/useDebounce'
import { useCatalogMeta, useLaws } from '../hooks/useLaws'
import { db } from '../lib/db'
import { searchLaws, useSearchStatus } from '../lib/search/client'
import { updateSettings, useSettings } from '../lib/settings'
import { addSearchHistory } from '../lib/history'
import { useBookmarkSet, useNoteSet } from '../lib/bookmarks'
import { toFaDigits, toLatinDigits } from '../lib/normalize'
import { relativeTime } from '../lib/format'
import { cn } from '../lib/utils'
import type { Article, ArticleStatus, CategoryId, DocGroup, SearchFilters, SearchResponse } from '../lib/types'

const EXAMPLES = [
  { q: 'ماده ۱۰ قانون مدنی', label: 'شماره ماده', icon: Hash },
  { q: 'اصل ۴۴', label: 'اصل قانون اساسی', icon: Hash },
  { q: '«قراردادهای خصوصی»', label: 'عبارت دقیق', icon: Quote },
  { q: 'مهریه', label: 'کلیدواژه', icon: Search },
  { q: 'کلاهبرداری', label: 'کلیدواژه', icon: Search },
  { q: 'خونبها تصادف', label: 'مفهومی', icon: Sparkles },
  { q: 'طلاغ', label: 'تحمل غلط تایپی', icon: Zap },
]

const STATUSES: ArticleStatus[] = ['لازم‌الاجرا', 'اصلاحی', 'منسوخ']
const DOC_GROUPS: { id: DocGroup; label: string }[] = [
  { id: 'law', label: 'قانون' },
  { id: 'regulation', label: 'آیین‌نامه/مقررات' },
  { id: 'ruling', label: 'رأی/نظریه' },
]

function countFilters(f: SearchFilters) {
  return (f.categories?.length ?? 0) + (f.docGroups?.length ?? 0) + (f.statuses?.length ?? 0) + (f.lawIds?.length ?? 0) + (f.yearFrom ? 1 : 0) + (f.yearTo ? 1 : 0)
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [limit, setLimit] = useState(40)
  const [res, setRes] = useState<SearchResponse | null>(null)
  const [articles, setArticles] = useState<Map<string, Article>>(new Map())
  const [loading, setLoading] = useState(false)
  const settings = useSettings()
  const status = useSearchStatus()
  const bookmarks = useBookmarkSet()
  const notes = useNoteSet()
  const debounced = useDebounce(q, 200)
  const inputRef = useRef<HTMLInputElement>(null)
  const history = useLiveQuery(() => db.history.orderBy('timestamp').reverse().limit(15).toArray(), [])
  const catalog = useCatalogMeta()
  const allLaws = useLaws()
  const lawTitle = (id: string) => allLaws?.find((l) => l.id === id)?.shortTitle ?? id

  useEffect(() => {
    if (!initial) inputRef.current?.focus()
  }, [initial])

  useEffect(() => {
    const p = params.get('q') ?? ''
    if (p !== q) setQ(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    const term = debounced.trim()
    if (term !== (params.get('q') ?? '')) setParams(term ? { q: term } : {}, { replace: true })
    if (!term) {
      setRes(null)
      return
    }
    let alive = true
    setLoading(true)
    searchLaws(term, { filters, limit, semantic: settings.semanticSearch })
      .then(async (r) => {
        if (!alive) return
        const arts = await db.articles.bulkGet(r.hits.map((h) => h.id))
        if (!alive) return
        setArticles(new Map(arts.filter(Boolean).map((a) => [a!.id, a!])))
        setRes(r)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filters, limit, settings.semanticSearch])

  useEffect(() => setLimit(40), [debounced, filters])

  const nFilters = countFilters(filters)
  const preparing = status.state === 'building' || status.state === 'loading' || status.state === 'saving'

  const kindLabel = useMemo(() => {
    if (!res) return ''
    if (res.kind === 'article') return 'جستجوی شماره ماده/اصل'
    if (res.kind === 'phrase') return 'عبارت دقیق'
    return 'کلیدواژه + فازی'
  }, [res])

  return (
    <div className="pb-2">
      <AppBar>
        <form
          role="search"
          className="flex items-center gap-2 pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            void addSearchHistory(q)
            inputRef.current?.blur()
          }}
        >
          <div className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 shadow-soft focus-within:border-brand/60">
            <Search className="h-5 w-5 shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ماده، اصل، کلیدواژه یا عبارت…"
              enterKeyHint="search"
              inputMode="search"
              aria-label="عبارت جستجو"
              className="h-full min-w-0 flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-muted/80"
            />
            {loading && <Loader2 className="h-4.5 w-4.5 animate-spin text-muted" />}
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="پاک کردن" className="grid h-8 w-8 place-items-center rounded-full text-muted">
                <X className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label="فیلترها"
            className={cn('relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border shadow-soft', nFilters ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line bg-surface')}
          >
            <Filter className="h-5 w-5" />
            {nFilters > 0 && (
              <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-contrast">
                {toFaDigits(nFilters)}
              </span>
            )}
          </button>
        </form>
      </AppBar>

      <main className="mx-auto max-w-3xl px-4 pt-3">
        {preparing && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status.state === 'building'
              ? `ساخت ایندکس جستجو… ${status.total ? toFaDigits(Math.round(((status.loaded ?? 0) / status.total) * 100)) + '٪' : ''}`
              : 'بارگذاری ایندکس جستجو…'}
          </div>
        )}

        {!q.trim() && (
          <div className="space-y-6">
            <section>
              <h2 className="mb-2.5 text-[15px] font-bold">نمونه جستجوها</h2>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((e) => (
                  <button
                    key={e.q}
                    type="button"
                    onClick={() => setQ(e.q)}
                    className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2 text-start shadow-soft active:scale-95"
                  >
                    <e.icon className="h-4 w-4 text-brand" />
                    <span className="text-[13.5px] font-semibold">{e.q}</span>
                    <span className="text-[11px] text-muted">{e.label}</span>
                  </button>
                ))}
              </div>
            </section>
            {!!history?.length && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[15px] font-bold">تاریخچه جستجو</h2>
                  <button type="button" onClick={() => void db.history.clear()} className="flex items-center gap-1 text-[12.5px] text-danger">
                    <Trash2 className="h-3.5 w-3.5" /> پاک کردن همه
                  </button>
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center">
                      <button type="button" onClick={() => setQ(h.query)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-start">
                        <History className="h-4 w-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate text-[14px]">{h.query}</span>
                        <span className="text-[11px] text-muted">{relativeTime(h.timestamp)}</span>
                      </button>
                      <button type="button" aria-label="حذف" onClick={() => void db.history.delete(h.id!)} className="grid h-11 w-11 place-items-center text-muted">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-2xl bg-surface-2/60 p-4 text-[13px] leading-7 text-muted">
              <p className="mb-1 font-bold text-fg">راهنمای جستجو</p>
              <ul className="list-inside list-disc space-y-0.5">
                <li>
                  شماره ماده: «ماده ۱۰ قانون مدنی»، «م ۱۰ ق.م»، «مدنی ۱۰»، «اصل ۴۴»، «ماده ۴۹۹ مکرر تعزیرات»
                </li>
                <li>عبارت دقیق را داخل گیومه بنویسید: «عسر و حرج»</li>
                <li>حروف عربی (ي/ك)، اعراب و نیم‌فاصله و ارقام فارسی/عربی خودکار یکسان‌سازی می‌شوند.</li>
                <li>غلط‌های تایپی جزئی تحمل می‌شوند؛ جستجوی مفهومی هم‌معناها را هم پیدا می‌کند.</li>
              </ul>
            </section>
          </div>
        )}

        {q.trim() && res && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span>
              <b className="text-fg">{toFaDigits(res.total)}</b> نتیجه در {toFaDigits(res.tookMs)} میلی‌ثانیه
            </span>
            {kindLabel && <span className="rounded-full bg-surface-2 px-2 py-0.5">{kindLabel}</span>}
            {res.parsed?.redirectedFrom && (
              <span className="rounded-full bg-ok-soft px-2 py-0.5 text-ok">
                ماده {toFaDigits(res.parsed.redirectedFrom.number)} {lawTitle(res.parsed.redirectedFrom.lawId)} = ماده {toFaDigits(res.parsed.number ?? '')}{' '}
                {lawTitle(res.parsed.lawId ?? '')}
              </span>
            )}
            {!!res.expandedWith?.length && (
              <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                <Sparkles className="h-3 w-3" /> {res.expandedWith.join('، ')}
              </span>
            )}
          </div>
        )}

        {q.trim() && !res && loading && <ArticleSkeleton count={4} />}

        {q.trim() && res && (
          <div className="space-y-3">
            {res.hits.map((h) => {
              const a = articles.get(h.id)
              if (!a) return null
              return (
                <ArticleCard
                  key={h.id}
                  article={a}
                  bookmarked={bookmarks.has(a.id)}
                  hasNote={notes.has(a.id)}
                  persian={settings.persianDigits}
                  showLaw
                  snippet={h.exact ? undefined : h.snippet}
                  terms={h.terms}
                />
              )
            })}
            {res.total > res.hits.length && res.hits.length >= limit && (
              <Button variant="outline" className="w-full" onClick={() => setLimit((l) => Math.min(l + 60, 400))}>
                نمایش نتایج بیشتر
              </Button>
            )}
            <EnactmentsBridge q={q.trim()} count={catalog?.qindex?.count} />
            {!res.hits.length && !preparing && (
              <EmptyState
                icon={<Search className="h-7 w-7" />}
                title="نتیجه‌ای یافت نشد"
                description={nFilters ? 'فیلترها را کم کنید یا عبارت دیگری امتحان کنید.' : 'املای واژه را بررسی کنید یا از هم‌معناها استفاده کنید.'}
                action={
                  nFilters ? (
                    <Button variant="outline" onClick={() => setFilters({})}>
                      حذف فیلترها
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        )}
      </main>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        semantic={settings.semanticSearch}
        onSemantic={(v) => updateSettings({ semanticSearch: v })}
      />
    </div>
  )
}

/** پل به «فهرست مصوبات»: جستجوی همان عبارت در عنوان ۱۵۰ هزار مصوبه سامانه ملی قوانین */
function EnactmentsBridge({ q, count }: { q: string; count?: number }) {
  if (!q) return null
  return (
    <Link
      to={`/enactments?q=${encodeURIComponent(q)}`}
      className="flex items-center gap-3 rounded-2xl border border-dashed border-brand/40 bg-surface px-4 py-3 text-[13.5px] text-brand-strong"
    >
      <Library className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 leading-6">
        جستجوی «{q}» در عنوان {count ? toFaDigits(count.toLocaleString('fa-IR')) : 'همه'} مصوبه سامانه ملی قوانین
        <span className="block text-[11.5px] text-muted">قوانین، مقررات، آرای وحدت رویه و نظریات مشورتی — با پیوند متن رسمی</span>
      </span>
      <ChevronLeft className="h-4.5 w-4.5 shrink-0" />
    </Link>
  )
}

function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  semantic,
  onSemantic,
}: {
  open: boolean
  onClose: () => void
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  semantic: boolean
  onSemantic: (v: boolean) => void
}) {
  const catalog = useCatalogMeta()
  const laws = useLaws()
  const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v])
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="فیلتر نتایج"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose}>
            اعمال
          </Button>
          <Button variant="secondary" onClick={() => onChange({})}>
            پاک کردن
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 p-3">
          <span>
            <span className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="h-4 w-4 text-accent" /> جستجوی مفهومی
            </span>
            <span className="text-[12px] text-muted">یافتن مواد مرتبط با هم‌معناها (مثلاً «خونبها» ← دیه)</span>
          </span>
          <Switch checked={semantic} onChange={onSemantic} label="جستجوی مفهومی" />
        </label>

        <div>
          <p className="mb-2 text-sm font-bold">دسته موضوعی</p>
          <div className="flex flex-wrap gap-2">
            {(catalog?.categories ?? []).map((c) => (
              <Chip
                key={c.id}
                selected={filters.categories?.includes(c.id)}
                onClick={() => onChange({ ...filters, categories: toggle<CategoryId>(filters.categories, c.id) })}
              >
                {c.title}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">نوع سند</p>
          <div className="flex flex-wrap gap-2">
            {DOC_GROUPS.map((g) => (
              <Chip key={g.id} selected={filters.docGroups?.includes(g.id)} onClick={() => onChange({ ...filters, docGroups: toggle(filters.docGroups, g.id) })}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">وضعیت ماده</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Chip key={s} selected={filters.statuses?.includes(s)} onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}>
                {s}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">سال تصویب قانون (شمسی)</p>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              placeholder="از (مثلاً ۱۳۰۰)"
              value={filters.yearFrom ? toFaDigits(filters.yearFrom) : ''}
              onChange={(e) => {
                const v = parseInt(toLatinDigits(e.target.value), 10)
                onChange({ ...filters, yearFrom: Number.isFinite(v) ? v : undefined })
              }}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand/60"
              aria-label="از سال"
            />
            <span className="text-muted">تا</span>
            <input
              inputMode="numeric"
              placeholder="تا (مثلاً ۱۴۰۵)"
              value={filters.yearTo ? toFaDigits(filters.yearTo) : ''}
              onChange={(e) => {
                const v = parseInt(toLatinDigits(e.target.value), 10)
                onChange({ ...filters, yearTo: Number.isFinite(v) ? v : undefined })
              }}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand/60"
              aria-label="تا سال"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">قانون خاص</p>
          <div className="flex flex-wrap gap-2">
            {(laws ?? [])
              .filter((l) => l.available)
              .map((l) => (
                <Chip key={l.id} selected={filters.lawIds?.includes(l.id)} onClick={() => onChange({ ...filters, lawIds: toggle(filters.lawIds, l.id) })}>
                  {l.shortTitle}
                </Chip>
              ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
