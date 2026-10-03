import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown, Layers3 } from 'lucide-react'
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
import { cn } from '../lib/utils'
import type { Law } from '../lib/types'

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
      return catalog.hierarchy.map((h) => ({
        id: h.id as string,
        title: `${toFaDigits(h.rank)}. ${h.title}`,
        description: h.description,
        laws: list.filter((l) => l.hierarchy === h.id),
        icon: <Layers3 className="h-5 w-5" />,
      }))
    return catalog.categories.map((c) => ({
      id: c.id as string,
      title: c.title,
      description: undefined as string | undefined,
      laws: list.filter((l) => l.category === c.id),
      icon: <CategoryIcon id={c.id} className="h-5 w-5" />,
    }))
  }, [catalog, laws, view, onlyAvailable])

  const totals = useMemo(() => {
    const avail = (laws ?? []).filter((l) => l.available)
    return { laws: avail.length, catalog: laws?.length ?? 0, articles: avail.reduce((s, l) => s + l.stats.articles, 0) }
  }, [laws])

  return (
    <div className="pb-nav">
      <AppBar title="قوانین و مقررات" subtitle={`${toFaDigits(totals.laws)} قانون با متن کامل · ${toFaDigits(totals.articles)} ماده/اصل`}>
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
}: {
  id: string
  title: string
  description?: string
  laws: Law[]
  icon: React.ReactNode
  defaultOpen?: boolean
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
            {laws.length > available && ` · ${toFaDigits(laws.length - available)} در انتظار ورود`}
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2 px-3 pb-3">
              {description && <p className="px-1 pb-1 text-[12.5px] leading-6 text-muted">{description}</p>}
              {laws.length ? laws.map((l) => <LawCard key={l.id} law={l} />) : <p className="px-1 py-3 text-sm text-muted">موردی در این دسته نیست.</p>}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}
