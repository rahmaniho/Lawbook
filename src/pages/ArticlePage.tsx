import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, m } from 'framer-motion'
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Glasses,
  History,
  Link2,
  QrCode,
  Share2,
  Type,
  X,
} from 'lucide-react'
import { AppBar, AppBarAction } from '../components/layout/AppBar'
import { Disclaimer } from '../components/layout/Disclaimer'
import { ArticleText } from '../components/law/ArticleText'
import { StatusBadge } from '../components/law/StatusBadge'
import { ReaderSettings } from '../components/reader/ReaderSettings'
import { NoteEditor } from '../components/article/NoteEditor'
import { QrSheet } from '../components/article/QrSheet'
import { Sheet } from '../components/ui/Sheet'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ArticleSkeleton, Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { useLaw } from '../hooks/useLaws'
import { db } from '../lib/db'
import { toggleBookmark } from '../lib/bookmarks'
import { articleShareText, articleUrl, copyText, shareArticle } from '../lib/share'
import { useSettings } from '../lib/settings'
import { recordView } from '../lib/history'
import { toast } from '../lib/toast'
import { haptic } from '../lib/haptics'
import { setUi } from '../lib/ui'
import { toFaDigits } from '../lib/normalize'
import { articlePath, cn, lawPath, splitArticleId } from '../lib/utils'
import { officialSearchLinks } from './LawPage'

export default function ArticlePage() {
  const { lawId = '', key = '' } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const law = useLaw(lawId)
  const id = `${lawId}:${key}`
  const article = useLiveQuery(async () => (await db.articles.get(id)) ?? null, [id])
  const bookmarked = useLiveQuery(async () => !!(await db.bookmarks.where('articleId').equals(id).first()), [id])
  const [immersive, setImmersive] = useState(false)
  const [readerOpen, setReaderOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [pop, setPop] = useState(0)
  const persian = settings.persianDigits
  const d = (s: string) => (persian ? toFaDigits(s) : s)

  // ماده قبلی/بعدی
  const neighbors = useLiveQuery(async () => {
    if (!article) return { prev: undefined, next: undefined }
    const [prev, next] = await Promise.all([
      db.articles.where('[lawId+order]').between([lawId, -Infinity], [lawId, article.order], true, false).last(),
      db.articles.where('[lawId+order]').between([lawId, article.order], [lawId, Infinity], false, true).first(),
    ])
    return { prev, next }
  }, [article?.id])

  const related = useLiveQuery(async () => {
    if (!article?.relatedArticles?.length) return []
    return (await db.articles.bulkGet(article.relatedArticles.slice(0, 12))).filter(Boolean)
  }, [article?.id])

  const refKeys = useMemo(() => new Set((article?.relatedArticles ?? []).map((r) => splitArticleId(r).key)), [article])

  useEffect(() => {
    if (article) void recordView(article.id)
  }, [article])

  useEffect(() => {
    setUi({ immersive })
    return () => setUi({ immersive: false })
  }, [immersive])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return
      if (e.key === 'ArrowLeft' && neighbors?.next) navigate(articlePath(lawId, neighbors.next.key), { replace: true })
      if (e.key === 'ArrowRight' && neighbors?.prev) navigate(articlePath(lawId, neighbors.prev.key), { replace: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [neighbors, lawId, navigate])

  if (article === undefined || law === undefined)
    return (
      <div className="pb-nav">
        <AppBar back title={<Skeleton className="h-5 w-28" />} />
        <div className="mx-auto max-w-3xl p-4">
          <ArticleSkeleton count={1} />
        </div>
      </div>
    )

  if (!article || !law)
    return (
      <div className="pb-nav">
        <AppBar back title="ماده یافت نشد" />
        <EmptyState
          icon={<X className="h-7 w-7" />}
          title="این ماده در داده‌های فعلی وجود ندارد"
          description="ممکن است داده‌ها هنوز کامل دریافت نشده باشند یا پیوند نادرست باشد."
          action={
            <Link to={lawPath(lawId)} className="text-brand">
              بازگشت به قانون
            </Link>
          }
        />
      </div>
    )

  const lawTitle = law.shortTitle
  const doShare = async () => {
    const r = await shareArticle(article, lawTitle, persian)
    if (r === 'copied') toast('متن ماده برای اشتراک کپی شد', { tone: 'success' })
  }
  const doCopy = async () => {
    if (await copyText(articleShareText(article, lawTitle, persian))) {
      haptic('success')
      toast('متن ماده کپی شد', { tone: 'success' })
    }
  }
  const doBookmark = async () => {
    await toggleBookmark(article.id)
    setPop((p) => p + 1)
  }

  return (
    <div className={cn('min-h-dvh', immersive ? 'pb-10' : 'pb-nav', settings.readerTheme === 'sepia' && 'reader-sepia bg-[var(--bg)]')}>
      <AnimatePresence initial={false}>
        {!immersive && (
          <m.div initial={{ y: -70 }} animate={{ y: 0 }} exit={{ y: -70 }} className="sticky top-0 z-40">
            <AppBar
              back={lawPath(lawId)}
              title={d(article.label)}
              subtitle={lawTitle}
              actions={
                <>
                  <AppBarAction label={bookmarked ? 'حذف نشان' : 'نشان‌گذاری'} onClick={doBookmark} active={!!bookmarked}>
                    <m.span key={pop} initial={pop ? { scale: 0.6 } : false} animate={{ scale: [1.35, 1] }} transition={{ duration: 0.35 }}>
                      {bookmarked ? <BookmarkCheck className="h-5.5 w-5.5 fill-current" /> : <Bookmark className="h-5.5 w-5.5" />}
                    </m.span>
                  </AppBarAction>
                  <AppBarAction label="اشتراک‌گذاری" onClick={doShare}>
                    <Share2 className="h-5.5 w-5.5" />
                  </AppBarAction>
                  <AppBarAction label="تنظیمات مطالعه" onClick={() => setReaderOpen(true)}>
                    <Type className="h-5.5 w-5.5" />
                  </AppBarAction>
                </>
              }
            />
          </m.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <article className={cn('rounded-card border border-line bg-surface p-5 shadow-soft', immersive && 'border-transparent bg-transparent p-1 shadow-none')}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Link to={lawPath(lawId)} className="text-[13px] font-semibold text-brand">
              {law.title}
            </Link>
          </div>
          {(article.section || article.chapter) && (
            <p className="mb-3 text-[12.5px] leading-6 text-muted">{d([article.section, article.chapter].filter(Boolean).join(' › '))}</p>
          )}
          <div className="mb-4 flex items-center gap-2">
            <h1 className="text-[22px] font-black text-brand-strong">{d(article.label)}</h1>
            <StatusBadge status={article.status} className="ms-1" />
            <button
              type="button"
              onClick={() => setImmersive((v) => !v)}
              className={cn('ms-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium', immersive ? 'bg-brand text-brand-contrast' : 'bg-surface-2')}
              aria-pressed={immersive}
            >
              <Glasses className="h-4 w-4" /> {immersive ? 'خروج از حالت مطالعه' : 'حالت مطالعه'}
            </button>
          </div>

          <ArticleText text={article.text} lawId={lawId} refKeys={refKeys} persian={persian} className={cn(!settings.justify && 'align-start')} />

          {!!article.notes?.length && (
            <div className="mt-5 space-y-3">
              {article.notes.map((n, i) => (
                <div key={i} className="rounded-2xl border-s-4 border-brand/40 bg-surface-2/60 p-3.5">
                  <ArticleText text={n} lawId={lawId} refKeys={refKeys} persian={persian} className={cn(!settings.justify && 'align-start')} />
                </div>
              ))}
            </div>
          )}

          {!immersive && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button size="sm" variant="secondary" onClick={doCopy}>
                <Copy className="h-4 w-4" /> کپی
              </Button>
              <Button size="sm" variant="secondary" onClick={doShare}>
                <Share2 className="h-4 w-4" /> اشتراک
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setQrOpen(true)}>
                <QrCode className="h-4 w-4" /> QR
              </Button>
              <Button size="sm" variant={bookmarked ? 'soft' : 'secondary'} onClick={doBookmark}>
                {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} {bookmarked ? 'نشان‌شده' : 'نشان'}
              </Button>
            </div>
          )}
        </article>

        {!immersive && (
          <>
            {!!article.amendments?.length && (
              <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
                <h2 className="mb-2 flex items-center gap-2 font-bold">
                  <History className="h-4.5 w-4.5 text-accent" /> سابقه اصلاحات
                </h2>
                <ul className="space-y-2 text-[13.5px] leading-6">
                  {article.amendments.map((am, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Badge tone={am.kind === 'منسوخ' || am.kind === 'حذف' ? 'danger' : 'accent'}>{am.kind}</Badge>
                      <span className="min-w-0 flex-1 text-muted">{d(am.date ? `${am.date} — ${am.raw.replace(/^\[|\]\.?$/g, '')}` : am.raw)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!!related?.length && (
              <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
                <h2 className="mb-2 flex items-center gap-2 font-bold">
                  <Link2 className="h-4.5 w-4.5 text-brand" /> مواد مرتبط
                </h2>
                <div className="flex flex-wrap gap-2">
                  {related.map((r) => (
                    <Link key={r!.id} to={articlePath(r!.lawId, r!.key)} className="rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-semibold text-brand-strong">
                      {d(r!.label)}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {!!article.keywords.length && (
              <div className="flex flex-wrap gap-1.5">
                {article.keywords.map((k) => (
                  <Link key={k} to={`/search?q=${encodeURIComponent(k)}`} className="rounded-full border border-line px-3 py-1 text-[12px] text-muted">
                    #{k.replace(/\s/g, '_')}
                  </Link>
                ))}
              </div>
            )}

            <NoteEditor articleId={article.id} />

            <section className="rounded-card border border-line bg-surface p-4 text-[13px] leading-6 shadow-soft">
              <p>
                <b>منبع:</b> {law.source?.origin ?? 'سامانه ملی قوانین و مقررات'}
              </p>
              <p>
                <b>آخرین به‌روزرسانی متن:</b> {law.lastUpdated ? toFaDigits(law.lastUpdated) : 'نامشخص'}{' '}
                <span className="text-muted">(تاریخ برداشت متن تلفیقی)</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {officialSearchLinks(law)
                  .slice(0, 2)
                  .map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand underline">
                      {l.label} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
              </div>
            </section>
          </>
        )}

        <nav className="flex items-stretch gap-3" aria-label="ماده قبلی و بعدی">
          {neighbors?.prev ? (
            <Link
              replace
              to={articlePath(lawId, neighbors.prev.key)}
              className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-surface p-3.5 shadow-soft active:scale-[0.98]"
            >
              <ChevronRight className="h-5 w-5 text-muted" />
              <span>
                <span className="block text-[11.5px] text-muted">قبلی</span>
                <span className="font-bold">{d(neighbors.prev.label)}</span>
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {neighbors?.next ? (
            <Link
              replace
              to={articlePath(lawId, neighbors.next.key)}
              className="flex flex-1 items-center justify-end gap-2 rounded-2xl border border-line bg-surface p-3.5 text-end shadow-soft active:scale-[0.98]"
            >
              <span>
                <span className="block text-[11.5px] text-muted">بعدی</span>
                <span className="font-bold">{d(neighbors.next.label)}</span>
              </span>
              <ChevronLeft className="h-5 w-5 text-muted" />
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>

        {!immersive && <Disclaimer compact />}
      </main>

      <Sheet open={readerOpen} onClose={() => setReaderOpen(false)} title="تنظیمات مطالعه">
        <ReaderSettings />
      </Sheet>
      <QrSheet open={qrOpen} onClose={() => setQrOpen(false)} url={articleUrl(article)} title={`${lawTitle} — ${d(article.label)}`} />
    </div>
  )
}
