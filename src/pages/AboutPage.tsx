import { Link } from 'react-router'
import { BadgeCheck, CheckCircle2, ChevronLeft, Clock3, ExternalLink, Database, Library, ShieldCheck, Scale } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { Disclaimer } from '../components/layout/Disclaimer'
import { useCatalogMeta, useLaws } from '../hooks/useLaws'
import { Q_TYPES } from '../lib/qindex/model'
import { useDataState } from '../lib/data/store'
import { toFaDigits } from '../lib/normalize'
import { lawPath, cn } from '../lib/utils'
import { CREDITS } from '../lib/credits'

const CHECKLIST: { title: string; laws: string[] }[] = [
  { title: 'قانون اساسی (۱۷۷ اصل)', laws: ['constitution'] },
  { title: 'قانون مدنی (جلدهای ۱ تا ۳؛ کتاب‌های ۱ تا ۱۰ جلد دوم)', laws: ['civil-code'] },
  { title: 'قانون مجازات اسلامی ۱۳۹۲ (حدود، قصاص، دیات) + تعزیرات', laws: ['penal-code', 'penal-code-tazirat'] },
  { title: 'قانون آیین دادرسی کیفری', laws: ['criminal-procedure'] },
  { title: 'قانون آیین دادرسی مدنی (۵۲۹ ماده)', laws: ['civil-procedure'] },
  { title: 'قانون تجارت + لایحه اصلاحی ۱۳۴۷', laws: ['commercial-code', 'commercial-code-amendment-1347'] },
  { title: 'قانون تجارت الکترونیکی (۸۱ ماده)', laws: ['electronic-commerce'] },
  { title: 'قانون حمایت خانواده ۱۳۹۱ + آیین‌نامه اجرایی', laws: ['family-protection', 'family-protection-regulation'] },
  { title: 'قانون کار ۱۳۶۹ (۲۰۳ ماده)', laws: ['labor'] },
  { title: 'قانون دیوان عدالت اداری', laws: ['administrative-court'] },
  { title: 'قوانین مالیات‌های مستقیم و ارزش افزوده', laws: ['direct-taxes', 'vat'] },
  { title: 'قوانین برنامه‌های توسعه (۱ تا ۷)', laws: ['development-plans'] },
  { title: 'قوانین شهرداری، محیط زیست و مالکیت فکری', laws: ['municipality', 'environment-protection', 'copyright', 'industrial-property'] },
  { title: 'آرای وحدت رویه دیوان عالی کشور', laws: ['supreme-court-precedents'] },
  { title: 'نظریات مشورتی اداره کل حقوقی قوه قضاییه', laws: ['advisory-opinions'] },
]

const SOURCES = [
  { name: 'سامانه ملی قوانین و مقررات', url: 'https://qavanin.ir', note: 'منبع اصلی متن تلفیقی (با اصلاحات) — بیش از ۱۶۴ هزار مصوبه' },
  { name: 'روزنامه رسمی کشور', url: 'https://rrk.ir/Laws', note: 'مرجع رسمی انتشار قوانین و مقررات' },
  { name: 'مرکز پژوهش‌های مجلس', url: 'https://rc.majlis.ir/fa/law', note: 'متن مصوبات مجلس' },
  { name: 'معاونت حقوقی ریاست جمهوری (دتیک)', url: 'https://dotic.ir', note: 'پایگاه قوانین و مقررات' },
  { name: 'ایران‌کدیفای', url: 'https://irancodify.com', note: 'قوانین تنقیح‌شده' },
  { name: 'لالکس / دادپلاس', url: 'https://lawlex.app', note: 'مجموعه‌های دسته‌بندی‌شده (برای مقایسه)' },
]

export default function AboutPage() {
  const laws = useLaws()
  const catalog = useCatalogMeta()
  const qindex = catalog?.qindex
  const data = useDataState()
  const byId = new Map((laws ?? []).map((l) => [l.id, l]))
  const available = (laws ?? []).filter((l) => l.available)
  const snapshot = available.find((l) => l.source?.snapshotDateJalali)?.source

  return (
    <div className="pb-2">
      <AppBar back title="درباره ما" subtitle="اعتبار، منابع و پوشش قوانین" />
      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-4">
        <section className="rounded-card border border-line bg-surface p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <img src="/icons/192.png" alt="" className="h-14 w-14 rounded-2xl" width={56} height={56} />
            <div>
              <h1 className="text-lg font-extrabold">کتابچه قانون ایران</h1>
              <p className="text-[13px] text-muted">مرور و جستجوی سریع و آفلاین قوانین جمهوری اسلامی ایران</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-surface-2 p-2.5">
              <p className="text-lg font-black text-brand-strong">{toFaDigits(available.length)}</p>
              <p className="text-[11px] text-muted">قانون با متن کامل</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-2.5">
              <p className="text-lg font-black text-brand-strong">{toFaDigits((data.meta?.articleCount ?? available.reduce((s, l) => s + l.stats.articles, 0)).toLocaleString('fa-IR'))}</p>
              <p className="text-[11px] text-muted">ماده و اصل</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-2.5">
              <p className="text-lg font-black text-brand-strong">{toFaDigits(data.meta?.version ?? '—')}</p>
              <p className="text-[11px] text-muted">نسخه داده</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="credits-title" className="rounded-card border border-brand/25 bg-brand-soft/50 p-4 shadow-soft">
          <h2 id="credits-title" className="mb-2 flex items-center gap-2 font-extrabold">
            <BadgeCheck className="h-5 w-5 text-brand" /> اعتبار و منبع
          </h2>
          <p className="text-[14px] leading-7">{CREDITS.statement}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface p-3">
              <dt className="text-[12px] text-muted">{CREDITS.compiler.role}</dt>
              <dd className="mt-0.5 font-bold leading-7">{CREDITS.compiler.name}</dd>
            </div>
            <div className="rounded-2xl bg-surface p-3">
              <dt className="text-[12px] text-muted">{CREDITS.developer.role}</dt>
              <dd className="mt-0.5 font-bold leading-7">
                {CREDITS.developer.name} —{' '}
                <a href={CREDITS.developer.url} target="_blank" rel="noopener" className="text-brand-strong underline underline-offset-4" dir="ltr">
                  {CREDITS.developer.url}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <Disclaimer />

        <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-extrabold">
            <Scale className="h-5 w-5 text-brand" /> وضعیت پوشش قوانین اصلی
          </h2>
          <ul className="space-y-2">
            {CHECKLIST.map((c) => {
              const items = c.laws.map((id) => byId.get(id)).filter(Boolean)
              const done = items.filter((l) => l!.available).length
              const full = done === c.laws.length
              return (
                <li key={c.title} className="rounded-2xl border border-line p-3">
                  <p className="flex items-start gap-2 text-[14px] font-semibold leading-6">
                    {full ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ok" /> : <Clock3 className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', done ? 'text-accent' : 'text-muted')} />}
                    {c.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 ps-6">
                    {items.map((l) => (
                      <Link
                        key={l!.id}
                        to={lawPath(l!.id)}
                        className={cn('rounded-full px-2.5 py-0.5 text-[11.5px]', l!.available ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted')}
                      >
                        {l!.shortTitle} {l!.available ? `• ${toFaDigits(l!.stats.articles)}` : '• در انتظار'}
                      </Link>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[12px] leading-6 text-muted">
            موارد «در انتظار» با ابزار برداشت (scripts/scraper) از سامانه ملی قوانین قابل دریافت‌اند و پس از کنترل کیفیت در نسخه بعدی داده منتشر می‌شوند. هیچ
            متنی بدون منبع معتبر وارد اپلیکیشن نمی‌شود.
          </p>
        </section>

        <section className="rounded-card border border-line bg-surface p-4 text-[13.5px] leading-7 shadow-soft">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold">
            <Library className="h-5 w-5 text-brand" /> فهرست همه مصوبات سامانه ملی قوانین
          </h2>
          <p>
            عنوان، تاریخ و مرجع تصویب <b>{qindex ? toFaDigits(qindex.count.toLocaleString('fa-IR')) : '—'}</b> مصوبه ثبت‌شده در سامانه ملی قوانین و مقررات، از
            {qindex ? ` ${toFaDigits(qindex.earliestYear)} ` : ' ۱۲۸۵ '}تا آخرین مصوبه فهرست ({qindex ? toFaDigits(qindex.latestDate) : '—'})، در اپ قابل جستجوست و برای
            هر مورد پیوند متن رسمی در سامانه نمایش داده می‌شود. این فهرست شامل متن مصوبات نیست؛ متن کامل فقط برای قوانین جدول بالا در اپ موجود است.
          </p>
          {qindex && (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Q_TYPES.filter((t) => qindex.byType[t.id]).map((t) => (
                <li key={t.id}>
                  <Link to={`/enactments?t=${t.id}`} className="block rounded-xl bg-surface-2 px-3 py-2">
                    <span className="block text-[15px] font-black text-brand-strong">{toFaDigits(qindex.byType[t.id]!.toLocaleString('fa-IR'))}</span>
                    <span className="block text-[11.5px] leading-5 text-muted">{t.short}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/enactments" className="mt-3 flex items-center justify-between rounded-xl border border-line px-3 py-2 font-semibold text-brand-strong">
            باز کردن فهرست مصوبات <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="mt-2 text-[12px] leading-6 text-muted">
            منشأ: فهرست مصوبات سامانه ملی قوانین (qavanin.ir) که با خزنده متن‌باز abdal برداشت و در مخزن fatemeq/standard بایگانی شده است. مصوبات پس از تاریخ
            آخرین مصوبه فهرست، با فرمان list ابزار برداشت از شبکه داخل ایران افزوده می‌شوند.
          </p>
        </section>

        <section className="rounded-card border border-line bg-surface p-4 text-[13.5px] leading-7 shadow-soft">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold">
            <Database className="h-5 w-5 text-brand" /> منشأ داده‌ها
          </h2>
          <p>
            متن قوانین موجود، «متن تلفیقی با اصلاحات» سامانه ملی قوانین و مقررات (qavanin.ir) است که در تاریخ{' '}
            <b>{snapshot?.snapshotDateJalali ? toFaDigits(snapshot.snapshotDateJalali) : '—'}</b> برداشت و در مخزن متن‌باز{' '}
            {snapshot?.url ? (
              <a href={snapshot.url} target="_blank" rel="noreferrer" className="text-brand underline">
                {snapshot.upstream}
              </a>
            ) : (
              snapshot?.upstream
            )}{' '}
            (مجوز {snapshot?.license ?? 'MIT'}) بایگانی شده است. متن‌ها بدون بازنویسی وارد شده‌اند و فقط نرمال‌سازی نگارشی (ی/ک عربی، نیم‌فاصله، کشیده) روی آن‌ها
            اعمال شده است. اصلاحات پس از این تاریخ در این نسخه لحاظ نشده است.
          </p>
          <ul className="mt-3 space-y-2">
            {SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                  <span>
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-[12px] text-muted">{s.note}</span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-card border border-line bg-surface p-4 text-[13.5px] leading-7 shadow-soft">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold">
            <ShieldCheck className="h-5 w-5 text-brand" /> حریم خصوصی
          </h2>
          <p>
            «کتابچه قانون» local-first است: نشان‌ها، یادداشت‌ها و تاریخچه فقط در مرورگر شما (IndexedDB) ذخیره می‌شوند. هیچ حساب کاربری، کوکی ردیابی یا ابزار آماری
            وجود ندارد. تنها درخواست شبکه، دریافت فایل‌های داده قوانین از همین سایت است.
          </p>
        </section>

        <section className="rounded-card border border-line bg-surface p-4 text-[12.5px] leading-6 text-muted shadow-soft">
          <h2 className="mb-1 font-bold text-fg">مجوزها</h2>
          <p>
            قلم وزیرمتن (SIL OFL 1.1) — قلم Noto Naskh Arabic (SIL OFL 1.1) — React، Dexie، MiniSearch، Workbox، framer-motion، lucide، pwa-install، Lit
            (MIT/Apache/ISC/BSD).
          </p>
        </section>
      </main>
    </div>
  )
}
