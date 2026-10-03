import { memo, useState } from 'react'
import { useNavigate } from 'react-router'
import { m, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion'
import { Bookmark, BookmarkCheck, Share2, StickyNote } from 'lucide-react'
import type { Article } from '../../lib/types'
import { articlePath, cn } from '../../lib/utils'
import { toggleBookmark } from '../../lib/bookmarks'
import { shareArticle } from '../../lib/share'
import { haptic } from '../../lib/haptics'
import { toast } from '../../lib/toast'
import { toFaDigits } from '../../lib/normalize'
import { Highlight } from '../search/Highlight'
import { StatusBadge } from './StatusBadge'

const TRIGGER = 84

/**
 * کارت ماده با حرکات لمسی:
 *  ← کشیدن به راست: نشان‌گذاری   → کشیدن به چپ: اشتراک‌گذاری   ضربه: نمایش متن کامل
 */
export const ArticleCard = memo(function ArticleCard({
  article,
  bookmarked,
  hasNote,
  persian,
  showLaw,
  snippet,
  terms,
  lawTitle,
}: {
  article: Article
  bookmarked: boolean
  hasNote?: boolean
  persian: boolean
  showLaw?: boolean
  snippet?: string
  terms?: string[]
  lawTitle?: string
}) {
  const navigate = useNavigate()
  const x = useMotionValue(0)
  const [armed, setArmed] = useState<'bookmark' | 'share' | null>(null)
  const bookmarkOpacity = useTransform(x, [0, 30, TRIGGER], [0, 0.6, 1])
  const shareOpacity = useTransform(x, [-TRIGGER, -30, 0], [1, 0.6, 0])
  const iconScaleB = useTransform(x, [0, TRIGGER], [0.6, 1.1])
  const iconScaleS = useTransform(x, [-TRIGGER, 0], [1.1, 0.6])

  const onDrag = (_: unknown, info: PanInfo) => {
    const next = info.offset.x > TRIGGER ? 'bookmark' : info.offset.x < -TRIGGER ? 'share' : null
    if (next !== armed) {
      if (next) haptic('medium')
      setArmed(next)
    }
  }

  const onDragEnd = async (_: unknown, info: PanInfo) => {
    setArmed(null)
    animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 })
    if (info.offset.x > TRIGGER) {
      await toggleBookmark(article.id)
    } else if (info.offset.x < -TRIGGER) {
      const r = await shareArticle(article, lawTitle ?? article.lawTitle, persian)
      if (r === 'copied') toast('متن ماده کپی شد', { tone: 'success' })
    }
  }

  const d = (s: string) => (persian ? toFaDigits(s) : s)
  const preview = snippet ?? article.text

  return (
    <div className="relative overflow-hidden rounded-card">
      {/* پس‌زمینه اقدام‌ها */}
      <m.div style={{ opacity: bookmarkOpacity }} className="absolute inset-0 flex items-center bg-brand ps-0 text-brand-contrast" aria-hidden>
        <m.span style={{ scale: iconScaleB }} className="absolute left-5 flex items-center gap-2 text-sm font-bold">
          {bookmarked ? <BookmarkCheck className="h-6 w-6" /> : <Bookmark className="h-6 w-6" />}
          {bookmarked ? 'حذف نشان' : 'نشان'}
        </m.span>
      </m.div>
      <m.div style={{ opacity: shareOpacity }} className="absolute inset-0 flex items-center bg-accent text-white" aria-hidden>
        <m.span style={{ scale: iconScaleS }} className="absolute right-5 flex items-center gap-2 text-sm font-bold">
          اشتراک <Share2 className="h-6 w-6" />
        </m.span>
      </m.div>

      {/* div با role=link (عنصر article نقش link را نمی‌پذیرد — قاعده aria-allowed-role) */}
      <m.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragSnapToOrigin={false}
        style={{ x }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onTap={() => navigate(articlePath(article.lawId, article.key))}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        tabIndex={0}
        role="link"
        aria-label={`${article.label} ${article.lawTitle}`}
        onKeyDown={(e) => e.key === 'Enter' && navigate(articlePath(article.lawId, article.key))}
        className={cn(
          'relative cursor-pointer touch-pan-y select-none rounded-card border border-line bg-surface p-4 shadow-soft outline-none',
          'focus-visible:ring-2 focus-visible:ring-brand',
          armed && 'shadow-float',
        )}
      >
        <header className="mb-2 flex items-center gap-2">
          <h3 className="text-[15px] font-extrabold text-brand-strong">{d(article.label)}</h3>
          {showLaw && <span className="min-w-0 truncate text-[13px] text-muted">{article.lawTitle}</span>}
          <span className="ms-auto flex items-center gap-1.5">
            {hasNote && <StickyNote className="h-4 w-4 text-accent" aria-label="یادداشت دارد" />}
            {bookmarked && <BookmarkCheck className="h-4.5 w-4.5 text-brand" aria-label="نشان‌شده" />}
            {article.status !== 'لازم‌الاجرا' && <StatusBadge status={article.status} />}
          </span>
        </header>
        {article.chapter && !showLaw && <p className="mb-1.5 truncate text-[12px] text-muted">{article.chapter}</p>}
        <p className={cn('text-[14.5px] leading-7 text-fg/90', snippet ? 'line-clamp-3' : 'line-clamp-4')}>
          {terms?.length ? <Highlight text={preview} terms={terms} persian={persian} /> : d(preview)}
        </p>
        {!!article.notes?.length && !snippet && <p className="mt-2 text-[12px] text-muted">{d(String(article.notes.length))} تبصره</p>}
      </m.div>
    </div>
  )
})
