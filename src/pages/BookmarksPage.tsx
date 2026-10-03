import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bookmark, Clock, StickyNote, Trash2, ChevronLeft } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { ArticleCard } from '../components/law/ArticleCard'
import { Segmented } from '../components/ui/Segmented'
import { EmptyState } from '../components/ui/EmptyState'
import { ArticleSkeleton } from '../components/ui/Skeleton'
import { db } from '../lib/db'
import { useNoteSet } from '../lib/bookmarks'
import { useSettings } from '../lib/settings'
import { relativeTime } from '../lib/format'
import { toFaDigits } from '../lib/normalize'
import { articlePath } from '../lib/utils'
import type { Article } from '../lib/types'

type Tab = 'bookmarks' | 'notes' | 'recent'

export default function BookmarksPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'bookmarks'
  const settings = useSettings()
  const notesSet = useNoteSet()
  const [confirmClear, setConfirmClear] = useState(false)

  const bookmarks = useLiveQuery(async () => {
    const list = await db.bookmarks.orderBy('createdAt').reverse().toArray()
    const arts = await db.articles.bulkGet(list.map((b) => b.articleId))
    return list.map((b, i) => ({ b, a: arts[i] }))
  }, [])

  const notes = useLiveQuery(async () => {
    const list = await db.notes.orderBy('updatedAt').reverse().toArray()
    const arts = await db.articles.bulkGet(list.map((n) => n.articleId))
    return list.map((n, i) => ({ n, a: arts[i] }))
  }, [])

  const recent = useLiveQuery(async () => {
    const list = await db.views.orderBy('viewedAt').reverse().limit(40).toArray()
    const arts = await db.articles.bulkGet(list.map((v) => v.articleId))
    return list.map((v, i) => ({ v, a: arts[i] }))
  }, [])

  return (
    <div className="pb-2">
      <AppBar title="نشان‌ها و یادداشت‌ها" subtitle="همه‌چیز فقط روی همین دستگاه ذخیره می‌شود">
        <Segmented
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          options={[
            { value: 'bookmarks', label: `نشان‌ها${bookmarks?.length ? ` (${toFaDigits(bookmarks.length)})` : ''}` },
            { value: 'notes', label: `یادداشت‌ها${notes?.length ? ` (${toFaDigits(notes.length)})` : ''}` },
            { value: 'recent', label: 'اخیر' },
          ]}
        />
      </AppBar>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        {tab === 'bookmarks' &&
          (!bookmarks ? (
            <ArticleSkeleton count={3} />
          ) : bookmarks.length === 0 ? (
            <EmptyState
              icon={<Bookmark className="h-7 w-7" />}
              title="هنوز ماده‌ای نشان نکرده‌اید"
              description="روی کارت هر ماده به راست بکشید یا دکمه نشان را بزنید تا اینجا ذخیره شود."
              action={
                <Link to="/laws" className="font-medium text-brand">
                  مرور قوانین
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-center text-[11.5px] text-muted">برای حذف نشان، کارت را به راست بکشید.</p>
              {bookmarks.map(({ b, a }) =>
                a ? (
                  <ArticleCard key={b.id} article={a as Article} bookmarked hasNote={notesSet.has(a.id)} persian={settings.persianDigits} showLaw />
                ) : (
                  <div key={b.id} className="flex items-center gap-2 rounded-card border border-dashed border-line p-4 text-sm text-muted">
                    ماده {b.articleId} در داده‌های فعلی یافت نشد (ممکن است در به‌روزرسانی حذف شده باشد).
                    <button type="button" onClick={() => void db.bookmarks.delete(b.id!)} className="ms-auto text-danger" aria-label="حذف">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ),
              )}
            </div>
          ))}

        {tab === 'notes' &&
          (!notes ? (
            <ArticleSkeleton count={2} />
          ) : notes.length === 0 ? (
            <EmptyState icon={<StickyNote className="h-7 w-7" />} title="یادداشتی ندارید" description="در صفحه هر ماده می‌توانید یادداشت شخصی بنویسید." />
          ) : (
            <ul className="space-y-3">
              {notes.map(({ n, a }) => (
                <li key={n.id}>
                  <Link to={a ? articlePath(a.lawId, a.key) : '#'} className="block rounded-card border border-line bg-surface p-4 shadow-soft">
                    <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                      <span className="font-bold text-brand-strong">{a ? toFaDigits(a.label) : n.articleId}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{a?.lawTitle}</span>
                      <span className="text-[11px] text-muted">{relativeTime(n.updatedAt)}</span>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-line text-[14px] leading-7">{n.text}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'recent' &&
          (!recent ? (
            <ArticleSkeleton count={2} />
          ) : recent.length === 0 ? (
            <EmptyState icon={<Clock className="h-7 w-7" />} title="هنوز ماده‌ای ندیده‌اید" />
          ) : (
            <>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {recent.map(({ v, a }) =>
                  a ? (
                    <li key={v.articleId}>
                      <Link to={articlePath(a.lawId, a.key)} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                        <span className="font-bold text-brand-strong">{toFaDigits(a.label)}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{a.lawTitle}</span>
                        <span className="text-[11px] text-muted">{relativeTime(v.viewedAt)}</span>
                        <ChevronLeft className="h-4 w-4 text-muted" />
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
              <div className="mt-4 flex justify-center">
                {confirmClear ? (
                  <button
                    type="button"
                    onClick={() => {
                      void db.views.clear()
                      setConfirmClear(false)
                    }}
                    className="text-sm font-bold text-danger"
                  >
                    تأیید پاک‌سازی تاریخچه مشاهده
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmClear(true)} className="flex items-center gap-1 text-sm text-muted">
                    <Trash2 className="h-4 w-4" /> پاک کردن تاریخچه مشاهده
                  </button>
                )}
              </div>
            </>
          ))}
      </main>
    </div>
  )
}
