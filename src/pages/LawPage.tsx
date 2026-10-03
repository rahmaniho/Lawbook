import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, m } from 'framer-motion'
import { BookOpenCheck, BookOpenText, ChevronDown, ChevronLeft, ExternalLink, Info, Library, ListTree, Loader2, Search, X, Hash, Clock3, Link2 } from 'lucide-react'
import { AppBar, AppBarAction } from '../components/layout/AppBar'
import { Disclaimer } from '../components/layout/Disclaimer'
import { ArticleCard } from '../components/law/ArticleCard'
import { TocTree } from '../components/law/TocTree'
import { ArticleText } from '../components/law/ArticleText'
import { Sheet } from '../components/ui/Sheet'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ArticleSkeleton, Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { useLaw, useLaws } from '../hooks/useLaws'
import { useDebounce } from '../hooks/useDebounce'
import { db } from '../lib/db'
import { useBookmarkSet, useNoteSet } from '../lib/bookmarks'
import { useSettings } from '../lib/settings'
import { searchLaws } from '../lib/search/client'
import { toFaDigits, toLatinDigits } from '../lib/normalize'
import { articlePath, cn, lawPath } from '../lib/utils'
import { toast } from '../lib/toast'
import { useDataSelector } from '../lib/data/store'
import type { Article, Law, SearchHit, TocNode } from '../lib/types'

type Row = { type: 'heading'; node: TocNode } | { type: 'article'; article: Article; hit?: SearchHit }

export function officialSearchLinks(law: Pick<Law, 'title' | 'source'>) {
  const q = encodeURIComponent(law.title)
  const official = law.source?.officialUrl
  return [
    ...(official ? [{ label: 'متن رسمی همین مورد در سامانه ملی قوانین', href: official, primary: true }] : []),
    { label: 'سامانه ملی قوانین (qavanin.ir)', href: 'https://qavanin.ir/', primary: false },
    { label: 'روزنامه رسمی (rrk.ir)', href: 'https://rrk.ir/Laws/', primary: false },
    { label: 'مرکز پژوهش‌های مجلس', href: 'https://rc.majlis.ir/fa/law', primary: false },
    ...(official ? [] : [{ label: 'جستجوی عنوان در سامانه ملی قوانین', href: `https://www.google.com/search?q=site%3Aqavanin.ir+%22${q}%22`, primary: false }]),
  ]
}

function OfficialLinks({ law, className }: { law: Law; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {officialSearchLinks(law).map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-[14px]',
            l.primary ? 'border-transparent bg-brand font-bold text-brand-contrast' : 'border-line bg-surface',
          )}
        >
          <span className="flex items-center gap-2">
            {l.primary && <Library className="h-4.5 w-4.5" />}
            {l.label}
          </span>
          <ExternalLink className={cn('h-4 w-4 shrink-0', l.primary ? '' : 'text-muted')} />
        </a>
      ))}
    </div>
  )
}

export default function LawPage() {
  const { lawId = '' } = useParams()
  const law = useLaw(lawId)
  const phase = useDataSelector((s) => s.state)

  if (law === undefined) return <LawSkeleton />
  if (law === null)
    return (
      <div className="pb-2">
        <AppBar back title="قانون یافت نشد" />
        {phase === 'installing' ? (
          <div className="mx-auto max-w-3xl p-4">
            <ArticleSkeleton />
          </div>
        ) : (
          <EmptyState icon={<Info className="h-7 w-7" />} title="این قانون در فهرست نیست" action={<Link to="/laws" className="text-brand">مشاهده فهرست قوانین</Link>} />
        )}
      </div>
    )
  if (!law.available) return <UnavailableLaw law={law} />
  return <AvailableLaw law={law} />
}

function LawSkeleton() {
  return (
    <div className="pb-2">
      <AppBar back title={<Skeleton className="h-5 w-40" />} />
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-36 rounded-card" />
        <ArticleSkeleton />
      </div>
    </div>
  )
}

/** پیشرفت نصب داده‌ها هنگام باز شدن مستقیم صفحه قانون پیش از تکمیل نسخه آفلاین */
function InstallProgress() {
  const p = useDataSelector((s) => s.progress)
  const pct = p && p.totalBytes ? Math.round((p.bytes / p.totalBytes) * 100) : p && p.total ? Math.round((p.loaded / p.total) * 100) : 0
  return (
    <p role="status" aria-live="polite" className="mb-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      در حال آماده‌سازی نسخه آفلاین… {toFaDigits(pct)}٪
    </p>
  )
}

function AvailableLaw({ law }: { law: Law }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const bookmarks = useBookmarkSet()
  const notes = useNoteSet()
  const allLaws = useLaws()
  const [tocOpen, setTocOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [jump, setJump] = useState('')
  const debounced = useDebounce(filter, 200)
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const persian = settings.persianDigits

  // در حین نصب/به‌روزرسانی داده‌ها، فهرست کامل فقط وقتی خوانده می‌شود که همه مواد این قانون وارد شده باشند
  // (شمارش ارزان است؛ خواندن و رندر دوباره ۱۳۰۰ ماده با هر بسته ورودی، رشته اصلی را قفل می‌کرد).
  const phase = useDataSelector((s) => s.state)
  const busy = phase === 'installing' || phase === 'checking' || phase === 'updating'
  const imported = useLiveQuery(async () => (busy ? db.articles.where('lawId').equals(law.id).count() : undefined), [law.id, busy])
  const complete = !busy || (imported !== undefined && imported >= law.stats.articles)
  const liveArticles = useLiveQuery(
    async () =>
      complete
        ? db.articles
            .where('[lawId+order]')
            .between([law.id, Dexie.minKey], [law.id, Dexie.maxKey])
            .toArray()
        : undefined,
    [law.id, complete],
  )
  // رندر فهرست در پس‌زمینه (transition قابل‌تقسیم) تا نخستین نمایش صدها کارت، وظیفه بلند نسازد
  const articles = useDeferredValue(liveArticles)

  useEffect(() => {
    const q = debounced.trim()
    if (!q) {
      setHits(null)
      return
    }
    let alive = true
    searchLaws(q, { filters: { lawIds: [law.id] }, limit: 200, semantic: settings.semanticSearch }).then((r) => alive && setHits(r.hits))
    return () => {
      alive = false
    }
  }, [debounced, law.id, settings.semanticSearch])

  const tocMap = useMemo(() => new Map((law.toc ?? []).map((t) => [t.id, t])), [law.toc])

  const rows: Row[] = useMemo(() => {
    if (!articles) return []
    if (hits) {
      const byId = new Map(articles.map((a) => [a.id, a]))
      return hits.filter((h) => byId.has(h.id)).map((h) => ({ type: 'article' as const, article: byId.get(h.id)!, hit: h }))
    }
    const out: Row[] = []
    let prevChain: string[] = []
    for (const a of articles) {
      const chain: TocNode[] = []
      let node = a.headingId ? tocMap.get(a.headingId) : undefined
      while (node) {
        chain.unshift(node)
        node = node.parent ? tocMap.get(node.parent) : undefined
      }
      const ids = chain.map((c) => c.id)
      let i = 0
      while (i < ids.length && ids[i] === prevChain[i]) i++
      for (let j = i; j < chain.length; j++) out.push({ type: 'heading', node: chain[j] })
      prevChain = ids
      out.push({ type: 'article', article: a })
    }
    return out
  }, [articles, hits, tocMap])

  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const update = () => setScrollMargin(listRef.current ? listRef.current.getBoundingClientRect().top + window.scrollY : 0)
    update()
    const ro = new ResizeObserver(update)
    if (listRef.current?.parentElement) ro.observe(listRef.current.parentElement)
    return () => ro.disconnect()
  }, [articles, hits])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]?.type === 'heading' ? 46 : 168),
    overscan: 8,
    scrollMargin,
    gap: 0,
  })

  // بازگردانی موقعیت اسکرول هنگام بازگشت از صفحه ماده
  const scrollKey = `kq:law-scroll:${law.id}`
  const restored = useRef(false)
  useEffect(() => {
    if (!articles || restored.current) return
    restored.current = true
    const y = Number(sessionStorage.getItem(scrollKey) || 0)
    if (y > 0) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
  }, [articles, scrollKey])
  useEffect(() => {
    const save = () => sessionStorage.setItem(scrollKey, String(window.scrollY))
    window.addEventListener('pagehide', save)
    return () => {
      save()
      window.removeEventListener('pagehide', save)
    }
  }, [scrollKey])

  const goToHeading = (node: TocNode) => {
    setTocOpen(false)
    const idx = rows.findIndex((r) => r.type === 'heading' && r.node.id === node.id)
    const target = idx >= 0 ? idx : rows.findIndex((r) => r.type === 'article' && r.article.key === node.first)
    if (target >= 0) setTimeout(() => virtualizer.scrollToIndex(target, { align: 'start', behavior: 'auto' }), 120)
  }

  const submitJump = () => {
    const raw = toLatinDigits(jump.trim())
    if (!raw) return
    const m = raw.match(/^(\d+)\s*(مکرر)?\s*(\d+)?$/)
    const key = m ? (m[2] ? `${m[1]}-bis${m[3] ?? ''}` : m[1]) : raw
    if (articles?.some((a) => a.key === key)) navigate(articlePath(law.id, key))
    else toast(`${law.unit} ${toFaDigits(raw)} در این قانون یافت نشد`, { tone: 'error' })
  }

  const crossLaws = (allLaws ?? []).filter((l) => law.crossLinks.includes(l.id))

  return (
    <div className="pb-2">
      <AppBar
        back="/laws"
        title={law.shortTitle}
        subtitle={law.approval?.date ? `مصوب ${toFaDigits(law.approval.date)}${law.approval.authority ? ' — ' + law.approval.authority : ''}` : undefined}
        actions={
          <>
            <AppBarAction label="جستجو در این قانون" onClick={() => setFilterOpen((v) => !v)} active={filterOpen}>
              <Search className="h-5.5 w-5.5" />
            </AppBarAction>
            <AppBarAction label="فهرست مطالب" onClick={() => setTocOpen(true)}>
              <ListTree className="h-5.5 w-5.5" />
            </AppBarAction>
            <AppBarAction label="شناسنامه قانون" onClick={() => setInfoOpen(true)}>
              <Info className="h-5.5 w-5.5" />
            </AppBarAction>
          </>
        }
      >
        <AnimatePresence initial={false}>
          {filterOpen && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3">
                <Search className="h-4.5 w-4.5 text-muted" />
                <input
                  autoFocus
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`جستجو در ${law.shortTitle}…`}
                  className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                  enterKeyHint="search"
                />
                {filter && (
                  <button type="button" onClick={() => setFilter('')} aria-label="پاک کردن" className="text-muted">
                    <X className="h-4.5 w-4.5" />
                  </button>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </AppBar>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        {!hits && (
          <>
            <LawHeader law={law} onInfo={() => setInfoOpen(true)} />
            {law.preamble && <Preamble text={law.preamble} persian={persian} />}
            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submitJump()
              }}
            >
              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3">
                <Hash className="h-4.5 w-4.5 shrink-0 text-muted" />
                <input
                  value={jump}
                  onChange={(e) => setJump(e.target.value)}
                  inputMode="numeric"
                  placeholder={`پرش به ${law.unit}… (مثلاً ${toFaDigits(law.id === 'constitution' ? 44 : 10)})`}
                  enterKeyHint="go"
                  className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                  aria-label={`شماره ${law.unit}`}
                />
              </div>
              <Button type="submit" variant="soft">
                برو
              </Button>
              <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => setTocOpen(true)} aria-label="فهرست مطالب">
                <ListTree className="h-5 w-5" />
              </Button>
            </form>
            {crossLaws.length > 0 && (
              <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
                {crossLaws.map((l) => (
                  <Link key={l.id} to={lawPath(l.id)} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-medium">
                    <Link2 className="h-3.5 w-3.5 text-brand" /> {l.shortTitle}
                  </Link>
                ))}
              </div>
            )}
            <p className="mt-4 text-center text-[11.5px] text-muted">کارت را به راست بکشید: نشان‌گذاری • به چپ: اشتراک‌گذاری • ضربه: متن کامل</p>
          </>
        )}
        {hits && (
          <p className="mb-3 text-sm text-muted">
            {toFaDigits(hits.length)} نتیجه در «{law.shortTitle}» برای «{filter}»
          </p>
        )}

        {/* تا رسیدن مواد، دست‌کم یک صفحه کامل جا رزرو می‌شود تا عناصر پایین فهرست جابه‌جا نشوند (CLS) */}
        <div ref={listRef} className={cn('relative mt-3', !articles && 'min-h-lvh')} style={{ height: articles ? virtualizer.getTotalSize() : undefined }}>
          {!articles && busy && <InstallProgress />}
          {!articles && <ArticleSkeleton count={5} />}
          {articles &&
            virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index]
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className="absolute inset-x-0 top-0"
                  style={{ transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)` }}
                >
                  {row.type === 'heading' ? (
                    <div className="pb-2 pt-4" style={{ paddingInlineStart: Math.min(row.node.depth, 4) * 10 }}>
                      <h2 className={cn('leading-7 text-fg', row.node.depth === 0 ? 'text-[16px] font-extrabold' : 'text-[14px] font-bold text-muted')}>
                        {toFaDigits(row.node.title)}
                      </h2>
                    </div>
                  ) : (
                    <div className="pb-3">
                      <ArticleCard
                        article={row.article}
                        bookmarked={bookmarks.has(row.article.id)}
                        hasNote={notes.has(row.article.id)}
                        persian={persian}
                        lawTitle={law.shortTitle}
                        snippet={row.hit?.snippet}
                        terms={row.hit?.terms}
                      />
                    </div>
                  )}
                </div>
              )
            })}
        </div>
        {articles && hits && !hits.length && (
          <EmptyState icon={<Search className="h-7 w-7" />} title="نتیجه‌ای یافت نشد" description="عبارت دیگری را امتحان کنید." />
        )}
        <Disclaimer className="mt-6" compact />
      </main>

      <Sheet open={tocOpen} onClose={() => setTocOpen(false)} title={`فهرست ${law.shortTitle}`}>
        <TocTree toc={law.toc ?? []} onSelect={goToHeading} unit={law.unit} />
      </Sheet>
      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title="شناسنامه قانون">
        <LawInfo law={law} />
      </Sheet>
    </div>
  )
}

function LawHeader({ law, onInfo }: { law: Law; onInfo: () => void }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <h1 className="text-[18px] font-extrabold leading-8 text-balance">{law.title}</h1>
      {law.description && <p className="mt-1 text-[13px] leading-6 text-muted">{law.description}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="brand">{law.docType}</Badge>
        <Badge tone="ok">{law.status}</Badge>
        <Badge>
          {toFaDigits(law.stats.articles)} {law.unit}
        </Badge>
        {!!law.stats.notes && <Badge>{toFaDigits(law.stats.notes)} تبصره</Badge>}
        {!!law.stats.amended && <Badge tone="accent">{toFaDigits(law.stats.amended)} اصلاحی</Badge>}
        {!!law.stats.repealed && <Badge tone="danger">{toFaDigits(law.stats.repealed)} منسوخ</Badge>}
      </div>
      <button type="button" onClick={onInfo} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-surface-2/70 px-3 py-2 text-start text-[12.5px]">
        <Clock3 className="h-4 w-4 shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          آخرین به‌روزرسانی متن: <b>{law.lastUpdated ? toFaDigits(law.lastUpdated) : 'نامشخص'}</b>
          <span className="text-muted"> — منبع: سامانه ملی قوانین</span>
        </span>
        <ChevronDown className="h-4 w-4 -rotate-90 text-muted" />
      </button>
      {law.source?.officialUrl && (
        <a
          href={law.source.officialUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-[12.5px] font-medium text-brand-strong"
        >
          <span className="flex items-center gap-2">
            <Library className="h-4 w-4" /> متن رسمی و اصلاحات بعدی در سامانه ملی قوانین
          </span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </section>
  )
}

function Preamble({ text, persian }: { text: string; persian: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="mt-3 rounded-card border border-line bg-surface shadow-soft">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 p-4 text-start font-bold">
        <BookOpenText className="h-5 w-5 text-brand" /> مقدمه
        <ChevronDown className={cn('ms-auto h-5 w-5 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <ArticleText text={text} lawId="" persian={persian} />
        </div>
      )}
    </section>
  )
}

export function LawInfo({ law }: { law: Law }) {
  const src = law.source
  return (
    <div className="space-y-4 text-[14px] leading-7">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted">عنوان</dt>
        <dd className="font-semibold">{law.title}</dd>
        {law.approval?.date && (
          <>
            <dt className="text-muted">تاریخ تصویب</dt>
            <dd>{toFaDigits(law.approval.date)}</dd>
          </>
        )}
        {law.approval?.authority && (
          <>
            <dt className="text-muted">مرجع تصویب</dt>
            <dd>{law.approval.authority}</dd>
          </>
        )}
        {law.approval?.note && (
          <>
            <dt className="text-muted">توضیح</dt>
            <dd>{law.approval.note}</dd>
          </>
        )}
        <dt className="text-muted">نوع سند</dt>
        <dd>{law.docType}</dd>
        <dt className="text-muted">آخرین به‌روزرسانی</dt>
        <dd>
          {law.lastUpdated ? toFaDigits(law.lastUpdated) : '—'}
          <span className="block text-[12px] text-muted">تاریخ برداشت متن تلفیقی از سامانه ملی قوانین؛ اصلاحات پس از این تاریخ لحاظ نشده است.</span>
        </dd>
        {src?.origin && (
          <>
            <dt className="text-muted">منبع متن</dt>
            <dd>{src.origin}</dd>
          </>
        )}
        {src?.upstream && (
          <>
            <dt className="text-muted">نسخه بایگانی</dt>
            <dd>
              {src.url ? (
                <a href={src.url} target="_blank" rel="noreferrer" className="text-brand underline">
                  {src.upstream}
                </a>
              ) : (
                src.upstream
              )}{' '}
              {src.license && <span className="text-muted">({src.license})</span>}
            </dd>
          </>
        )}
        {src?.qavaninId && (
          <>
            <dt className="text-muted">شناسه سامانه</dt>
            <dd>
              <a href={src.officialUrl ?? undefined} target="_blank" rel="noreferrer" className="text-brand underline">
                {toFaDigits(src.qavaninId)}
              </a>
            </dd>
          </>
        )}
        <dt className="text-muted">وضعیت تطبیق</dt>
        <dd>{src?.verification === 'verified' ? 'تطبیق‌شده با روزنامه رسمی' : 'برگرفته از سامانه ملی قوانین — تطبیق نهایی با روزنامه رسمی توصیه می‌شود'}</dd>
      </dl>
      {law.approvalNote && <p className="rounded-xl bg-surface-2 p-3 text-[13px]">{law.approvalNote}</p>}
      {law.expectedGaps?.map((g) => (
        <p key={g.from} className="rounded-xl bg-accent-soft p-3 text-[13px]">
          {g.reason}
        </p>
      ))}
      <div className="space-y-2">
        <p className="font-bold">مراجعه به منابع رسمی</p>
        <OfficialLinks law={law} />
      </div>
      <Disclaimer compact />
    </div>
  )
}

function UnavailableLaw({ law }: { law: Law }) {
  const settings = useSettings()
  const related = useLiveQuery(async () => {
    const ids = (law.related ?? []).map((r) => `${r.lawId}:${r.key}`)
    return (await db.articles.bulkGet(ids)).filter(Boolean) as Article[]
  }, [law.id])
  const isInfo = law.kind === 'info'
  return (
    <div className="pb-2">
      <AppBar back="/laws" title={law.shortTitle} subtitle={law.seeAlso ? 'متن در قانون دیگر' : isInfo ? 'توضیحی' : 'در انتظار ورود متن'} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <h1 className="text-[18px] font-extrabold leading-8">{law.title}</h1>
          {law.description && <p className="mt-2 text-[14px] leading-7 text-muted">{law.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="brand">{law.docType}</Badge>
            {law.approval?.date && <Badge>مصوب {toFaDigits(law.approval.date)}</Badge>}
            {!law.approval?.date && law.approval?.year && <Badge>سال {toFaDigits(law.approval.year)}</Badge>}
            {law.approval?.authority && <Badge>{law.approval.authority}</Badge>}
            {law.expectedArticles && <Badge>{toFaDigits(law.expectedArticles)} ماده</Badge>}
          </div>
        </section>

        {law.seeAlso && (
          <Link
            to={articlePath(law.seeAlso.lawId, law.seeAlso.key)}
            className="flex items-center gap-3 rounded-card border border-ok/30 bg-ok-soft p-4 text-[14px] leading-7 shadow-soft"
          >
            <BookOpenCheck className="h-6 w-6 shrink-0 text-ok" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">متن کامل در اپ موجود است</span>
              <span className="block text-[13px]">{law.seeAlso.label}</span>
            </span>
            <ChevronLeft className="h-5 w-5 shrink-0 text-muted" />
          </Link>
        )}

        {!isInfo && (
          <section className="rounded-card border border-accent/30 bg-accent-soft/60 p-4 text-[14px] leading-7">
            <p className="flex items-center gap-2 font-bold">
              <Loader2 className="h-4.5 w-4.5 text-accent" /> متن این مورد هنوز در اپ وارد نشده است
            </p>
            <p className="mt-1">
              برای حفظ دقت حقوقی، هیچ متنی بدون منبع معتبر وارد نمی‌شود. متن کامل باید با ابزار برداشت (scraper) از سامانه ملی قوانین دریافت و پس از
              کنترل کیفیت منتشر شود.{' '}
              {law.source?.officialUrl ? 'تا آن زمان متن رسمی را از پیوند زیر در سامانه ملی قوانین ببینید.' : 'تا آن زمان به منابع رسمی زیر مراجعه کنید.'}
            </p>
          </section>
        )}

        {!!law.members?.length && (
          <section className="space-y-2">
            <h2 className="font-extrabold">موارد این مجموعه</h2>
            {law.members.map((mb) => (
              <div key={mb.title} className="rounded-2xl border border-line bg-surface p-3.5 text-[13.5px] leading-7">
                <p className="font-semibold">{toFaDigits(mb.title)}</p>
                {(mb.date || mb.authority) && (
                  <p className="text-[12px] text-muted">
                    {mb.date && `مصوب ${toFaDigits(mb.date)}`}
                    {mb.authority && ` — ${mb.authority}`}
                  </p>
                )}
                {mb.note && <p className="text-[12px] text-muted">{mb.note}</p>}
                {mb.qavaninId && (
                  <a href={`https://qavanin.ir/Law/TreeText/${mb.qavaninId}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-strong">
                    <Library className="h-3.5 w-3.5" /> متن رسمی در سامانه ملی قوانین <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </section>
        )}

        {law.qindex && (
          <Link
            to={`/enactments?t=${law.qindex.type}${law.qindex.authority ? `&a=${encodeURIComponent(law.qindex.authority)}` : ''}`}
            className="flex items-center gap-3 rounded-card border border-brand/25 bg-brand-soft/50 p-4 shadow-soft"
          >
            <Library className="h-6 w-6 shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">مشاهده عناوین در فهرست مصوبات</span>
              <span className="block text-[12.5px] text-muted">
                عنوان، تاریخ و مرجع هر مورد با پیوند متن رسمی در سامانه ملی قوانین{law.qindex.authority ? ` — ${law.qindex.authority}` : ''}
              </span>
            </span>
            <ChevronLeft className="h-5 w-5 shrink-0 text-muted" />
          </Link>
        )}

        {!!related?.length && (
          <section className="space-y-3">
            <h2 className="font-extrabold">{isInfo ? 'اصول مرتبط در قانون اساسی' : 'مواد مرتبط'}</h2>
            {related.map((a) => (
              <Link key={a.id} to={articlePath(a.lawId, a.key)} className="block rounded-card border border-line bg-surface p-4 shadow-soft">
                <p className="mb-1 font-bold text-brand-strong">
                  {toFaDigits(a.label)} — {a.lawTitle}
                </p>
                <ArticleText text={a.text} lawId={a.lawId} persian={settings.persianDigits} className="!text-[15px]" />
              </Link>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-extrabold">منابع رسمی</h2>
          <OfficialLinks law={law} />
        </section>
        <Disclaimer />
      </main>
    </div>
  )
}
