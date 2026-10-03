import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calculator, ChevronLeft, Clock, Coins, Library, QrCode, ScrollText, Sparkles } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { PullToRefresh } from '../components/layout/PullToRefresh'
import { Disclaimer } from '../components/layout/Disclaimer'
import { DataStatus } from '../components/layout/DataStatus'
import { SearchBar } from '../components/search/SearchBar'
import { CategoryIcon } from '../components/law/CategoryIcon'
import { ArticleText } from '../components/law/ArticleText'
import { Skeleton } from '../components/ui/Skeleton'
import { useCatalogMeta, useLaws } from '../hooks/useLaws'
import { db } from '../lib/db'
import { refreshData, useDataSelector } from '../lib/data/store'
import { useSettings } from '../lib/settings'
import { toFaDigits } from '../lib/normalize'
import { jalaliDate } from '../lib/format'
import { articlePath, lawPath } from '../lib/utils'
import { addSearchHistory } from '../lib/history'

const POPULAR = ['مهریه', 'طلاق', 'حضانت', 'نفقه', 'چک', 'اجاره', 'قرارداد کار', 'دیه', 'ارث', 'کلاهبرداری', 'اصل ۴۴', 'ماده ۱۰ قانون مدنی']

function dayHash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export default function HomePage() {
  const navigate = useNavigate()
  const laws = useLaws()
  const catalog = useCatalogMeta()
  const phase = useDataSelector((s) => s.state)
  const settings = useSettings()
  const ready = phase === 'ready'

  const featured = useMemo(() => (laws ?? []).filter((l) => l.featured && l.available).slice(0, 10), [laws])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of laws ?? []) if (l.available) m.set(l.category, (m.get(l.category) ?? 0) + 1)
    return m
  }, [laws])

  const recent = useLiveQuery(async () => {
    const views = await db.views.orderBy('viewedAt').reverse().limit(4).toArray()
    const arts = await db.articles.bulkGet(views.map((v) => v.articleId))
    return arts.filter(Boolean)
  }, [])

  // «ماده روز»: انتخاب قطعی بر اساس تاریخ از قوانین اصلی
  const today = new Date().toISOString().slice(0, 10)
  const daily = useLiveQuery(async () => {
    if (!ready) return null
    const pool = ['constitution', 'civil-code', 'penal-code', 'family-protection', 'labor', 'civil-liability']
    const lawId = pool[dayHash(today) % pool.length]
    const count = await db.articles.where('lawId').equals(lawId).count()
    if (!count) return null
    const list = await db.articles
      .where('lawId')
      .equals(lawId)
      .offset(dayHash(today + lawId) % count)
      .limit(12)
      .toArray()
    return list.find((a) => a.status !== 'منسوخ' && a.text.length > 60 && a.text.length < 700) ?? list[0] ?? null
  }, [ready, today])

  return (
    <div className="pb-2">
      <AppBar
        title={
          <span className="flex items-center gap-2">
            <img src="/icons/icon.svg" alt="" className="h-7 w-7" width={28} height={28} />
            کتابچه قانون
          </span>
        }
        subtitle="قوانین جمهوری اسلامی ایران — سریع و آفلاین"
      >
        <SearchBar />
      </AppBar>

      <PullToRefresh onRefresh={() => refreshData()}>
        <main className="mx-auto max-w-3xl space-y-7 px-4 pt-4">
          <DataStatus />

          <section aria-labelledby="popular">
            <h2 id="popular" className="sr-only">
              جستجوهای پرتکرار
            </h2>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-no-ptr>
              {POPULAR.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    void addSearchHistory(q)
                    navigate(`/search?q=${encodeURIComponent(q)}`)
                  }}
                  className="h-9 shrink-0 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-medium shadow-soft active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="featured">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="featured" className="text-[17px] font-extrabold">
                قوانین پرکاربرد
              </h2>
              <Link to="/laws" className="flex items-center text-[13px] font-medium text-brand">
                همه قوانین <ChevronLeft className="h-4 w-4" />
              </Link>
            </div>
            {!laws || featured.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {featured.map((l) => (
                  <Link
                    key={l.id}
                    to={lawPath(l.id)}
                    className="flex h-[104px] flex-col justify-between rounded-2xl border border-line bg-surface p-3.5 shadow-soft transition-transform active:scale-[0.97]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                        <CategoryIcon id={l.category} className="h-4.5 w-4.5" />
                      </span>
                    </span>
                    <span>
                      <span className="block text-[14px] font-bold leading-6">{l.shortTitle}</span>
                      <span className="text-[11.5px] text-muted">
                        {toFaDigits(l.stats.articles)} {l.unit}
                        {l.approval?.year ? ` • ${toFaDigits(l.approval.year)}` : ''}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {(daily === undefined || (daily === null && (phase === 'installing' || phase === 'checking'))) && (
            <Skeleton className="h-[236px] rounded-card" />
          )}
          {daily && (
            <section aria-labelledby="daily" className="h-[236px] overflow-hidden rounded-card border border-line bg-surface p-4 shadow-soft">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-accent" />
                <h2 id="daily" className="font-extrabold">
                  ماده روز
                </h2>
                <span className="ms-auto text-xs text-muted">{jalaliDate(new Date())}</span>
              </div>
              <Link to={articlePath(daily.lawId, daily.key)} className="block">
                <p className="mb-1 text-[13px] font-bold text-brand-strong">
                  {toFaDigits(daily.label)} — {daily.lawTitle}
                </p>
                <ArticleText text={daily.text} lawId={daily.lawId} persian={settings.persianDigits} className="line-clamp-5 !text-[15px]" />
              </Link>
            </section>
          )}

          <section aria-labelledby="cats">
            <h2 id="cats" className="mb-3 text-[17px] font-extrabold">
              موضوعات حقوقی
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {(catalog?.categories ?? []).map((c) => (
                <Link
                  key={c.id}
                  to={`/laws?view=category&open=${c.id}`}
                  className="flex h-[60px] items-center gap-3 rounded-2xl bg-surface-2/70 px-3 transition-colors hover:bg-surface-2 active:scale-[0.98]"
                >
                  <CategoryIcon id={c.id} className="h-5 w-5 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 text-[13px] font-semibold leading-5">{c.title}</span>
                  <span className="text-[11.5px] text-muted">{toFaDigits(counts.get(c.id) ?? 0)}</span>
                </Link>
              ))}
              {!catalog && Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[60px] rounded-2xl" />)}
            </div>
          </section>

          {!!recent?.length && (
            <section aria-labelledby="recent">
              <h2 id="recent" className="mb-3 flex items-center gap-2 text-[17px] font-extrabold">
                <Clock className="h-4.5 w-4.5 text-muted" /> اخیراً دیده‌شده
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {recent.map((a) => (
                  <li key={a!.id}>
                    <Link to={articlePath(a!.lawId, a!.key)} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                      <span className="text-[14px] font-bold text-brand-strong">{toFaDigits(a!.label)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{a!.lawTitle}</span>
                      <ChevronLeft className="h-4 w-4 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link
            to="/enactments"
            className="flex h-[76px] items-center gap-3 rounded-card border border-brand/25 bg-brand-soft/50 px-4 shadow-soft active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-brand-contrast">
              <Library className="h-5.5 w-5.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-extrabold leading-7">فهرست همه مصوبات</span>
              <span className="block truncate text-[12px] text-muted">
                {catalog?.qindex ? `${toFaDigits(catalog.qindex.count.toLocaleString('fa-IR'))} عنوان سامانه ملی قوانین` : 'عناوین سامانه ملی قوانین'} • جستجو در عنوان‌ها
              </span>
            </span>
            <ChevronLeft className="h-5 w-5 shrink-0 text-muted" />
          </Link>

          <section aria-labelledby="tools">
            <h2 id="tools" className="mb-3 text-[17px] font-extrabold">
              ابزارها
            </h2>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { to: '/tools/inheritance', label: 'محاسبه ارث', icon: Calculator },
                { to: '/tools/diyeh', label: 'محاسبه دیه', icon: Coins },
                { to: '/tools/scan', label: 'اسکن QR', icon: QrCode },
              ].map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3.5 text-center shadow-soft active:scale-[0.97]"
                >
                  <t.icon className="h-6 w-6 text-brand" />
                  <span className="text-[12.5px] font-semibold">{t.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <Link to="/about" className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3.5 text-[13px]">
            <ScrollText className="h-5 w-5 text-brand" />
            <span className="flex-1">درباره ما، منابع، پوشش قوانین و تاریخ به‌روزرسانی</span>
            <ChevronLeft className="h-4 w-4 text-muted" />
          </Link>

          <Disclaimer />
        </main>
      </PullToRefresh>
    </div>
  )
}
