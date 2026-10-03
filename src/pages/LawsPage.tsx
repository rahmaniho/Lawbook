import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown, ChevronLeft, Layers3, Library } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { PullToRefresh } from '../components/layout/PullToRefresh'
import { SearchBar } from '../components/search/SearchBar'
import { LawCard } from '../components/law/LawCard'
import { CategoryIcon } from '../components/law/CategoryIcon'
import { Segmented } from '../components/ui/Segmented'
import { Chip } from '../components/ui/Chip'
import { Skeleton } from '../components/ui/Skeleton'
import { useCatalogMeta, useLaws } from '../hooks/useLaws'
import { refreshData } from '../lib/data/store'
import { toFaDigits } from '../lib/normalize'
import { cn, lawPath } from '../lib/utils'
import type { Law } from '../lib/types'
import { Q_TYPES, type QType } from '../lib/qindex/model'

type View = 'hierarchy' | 'category'

export default function LawsPage() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'hierarchy'
  const openParam = params.get('open')
  const laws = useLaws()
  const catalog = useCatalogMeta()
  const [onlyAvailable, setOnlyAvailable] = useState(false)

  const groups = useMemo(() => {
    if (!catalog || !laws) return []
    const list = onlyAvailable ? laws.filter((l) => l.available) : laws
    if (view === 'hierarchy')
      return catalog.hierarchy.map((h) => {
        const qtype = Q_TYPES.find((t) => t.hierarchy === h.id)?.id
        return {
          id: h.id as string,
          title: `${toFaDigits(h.rank)}. ${h.title}`,
          description: h.description,
          laws: list.filter((l) => l.hierarchy === h.id),
          icon: <Layers3 className="h-5 w-5" />,
          qindex: qtype && catalog.qindex?.byType[qtype] ? { type: qtype, count: catalog.qindex.byType[qtype]! } : undefined,
          subtopics: undefined,
        }
      })
    return catalog.categories.map((c) => ({
      id: c.id as string,
      title: c.title,
      description: undefined as string | undefined,
      laws: list.filter((l) => l.category === c.id),
      icon: <CategoryIcon id={c.id} className="h-5 w-5" />,
      qindex: undefined,
      subtopics: c.subtopics,
    }))
  }, [catalog, laws, view, onlyAvailable])

  const totals = useMemo(() => {
    const avail = (laws ?? []).filter((l) => l.available)
    return { laws: avail.length, catalog: laws?.length ?? 0, articles: avail.reduce((s, l) => s + l.stats.articles, 0) }
  }, [laws])

  return (
    <div className="pb-2">
      <AppBar title="قوانین و مقررات" subtitle={`${toFaDigits(totals.laws)} قانون با متن کامل • ${toFaDigits(totals.articles)} ماده/اصل`}>
        <SearchBar placeholder="جستجو در همه قوانین…" />
      </AppBar>
      <PullToRefresh onRefresh={() => refreshData()}>
        <main className="mx-auto max-w-3xl px-4 pt-4">
          <Segmented
            layoutId="laws-view"
            value={view}
            onChange={(v) => setParams({ view: v }, { replace: true })}
            options={[
              { value: 'hierarchy', label: 'سلسله‌مراتب حقوقی' },
              { value: 'category', label: 'دسته‌بندی موضوعی' },
            ]}
          />
          <Link
            to="/enactments"
            className="mt-3 flex items-center gap-3 rounded-card border border-brand/25 bg-brand-soft/50 p-3.5 shadow-soft active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-brand-contrast">
              <Library className="h-5.5 w-5.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold leading-7">فهرست همه مصوبات سامانه ملی قوانین</span>
              <span className="block text-[12.5px] leading-6 text-muted">
                {catalog?.qindex
                  ? `${toFaDigits(catalog.qindex.count.toLocaleString('fa-IR'))} عنوان از ${toFaDigits(catalog.qindex.earliestYear)} تا ${toFaDigits(catalog.qindex.latestDate.slice(0, 4))}`
                  : 'عناوین قوانین، مقررات، آرا و نظریات'}{' '}
                — جستجو در عنوان و پیوند متن رسمی
              </span>
            </span>
            <ChevronLeft className="h-5 w-5 shrink-0 text-muted" />
          </Link>

          <div className="mt-3 flex items-center gap-2">
            <Chip selected={onlyAvailable} onClick={() => setOnlyAvailable(!onlyAvailable)}>
              فقط دارای متن کامل
            </Chip>
            <span className="text-xs text-muted">{toFaDigits(totals.catalog)} مورد در فهرست</span>
          </div>

          <div className="mt-4 space-y-3">
            {!groups.length &&
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-card" />)}
            {groups.map((g) => (
              <Group key={`${view}-${g.id}`} {...g} defaultOpen={openParam ? openParam === g.id : view === 'hierarchy' && (g.id === 'constitution' || g.id === 'statute')} />
            ))}
          </div>
        </main>
      </PullToRefresh>
    </div>
  )
}

function Group({
  title,
  description,
  laws,
  icon,
  defaultOpen,
  qindex,
  subtopics,
}: {
  id: string
  title: string
  description?: string
  laws: Law[]
  icon: React.ReactNode
  defaultOpen?: boolean
  qindex?: { type: QType; count: number }
  subtopics?: { title: string; laws: string[] }[]
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const available = laws.filter((l) => l.available).length
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-start">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold leading-6">{title}</span>
          <span className="text-[12px] text-muted">
            {toFaDigits(available)} با متن کامل
            {laws.length > available && ` • ${toFaDigits(laws.length - available)} در انتظار ورود`}
            {qindex && ` • ${toFaDigits(qindex.count.toLocaleString('fa-IR'))} عنوان در فهرست`}
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2 px-3 pb-3">
              {description && <p className="px-1 pb-1 text-[12.5px] leading-6 text-muted">{description}</p>}
              {!!subtopics?.length && (
                <div className="flex flex-wrap gap-1.5 px-1 pb-1" aria-label="زیرموضوع‌ها">
                  {subtopics.map((st) => (
                    <Link
                      key={st.title}
                      to={lawPath(st.laws.find((id) => laws.some((l) => l.id === id && l.available)) ?? st.laws[0])}
                      className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12.5px] font-medium"
                    >
                      {st.title}
                    </Link>
                  ))}
                </div>
              )}
              {qindex && (
                <Link
                  to={`/enactments?t=${qindex.type}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-brand/40 px-3.5 py-2.5 text-[13px] text-brand-strong"
                >
                  <span className="flex items-center gap-2">
                    <Library className="h-4 w-4" /> {toFaDigits(qindex.count.toLocaleString('fa-IR'))} عنوان «{Q_TYPES.find((t) => t.id === qindex.type)?.short}» در فهرست مصوبات
                  </span>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              )}
              {laws.length ? laws.map((l) => <LawCard key={l.id} law={l} />) : <p className="px-1 py-3 text-sm text-muted">موردی در این دسته نیست.</p>}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}
