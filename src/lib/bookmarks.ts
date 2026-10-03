import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './db'
import { haptic } from './haptics'
import { toast } from './toast'

export async function isBookmarked(articleId: string) {
  return !!(await db.bookmarks.where('articleId').equals(articleId).first())
}

export async function toggleBookmark(articleId: string, opts: { silent?: boolean } = {}): Promise<boolean> {
  const existing = await db.bookmarks.where('articleId').equals(articleId).first()
  if (existing) {
    await db.bookmarks.delete(existing.id!)
    haptic('light')
    if (!opts.silent)
      toast('از نشان‌ها حذف شد', {
        action: { label: 'بازگردانی', onClick: () => void db.bookmarks.add({ articleId, createdAt: existing.createdAt }) },
      })
    return false
  }
  await db.bookmarks.add({ articleId, createdAt: Date.now() })
  haptic('success')
  if (!opts.silent) toast('به نشان‌ها اضافه شد', { tone: 'success' })
  return true
}

/** مجموعه شناسه مواد نشان‌شده (یک کوئری برای کل فهرست) */
export function useBookmarkSet(): Set<string> {
  const list = useLiveQuery(() => db.bookmarks.toArray(), [])
  return useMemo(() => new Set((list ?? []).map((b) => b.articleId)), [list])
}

export function useNoteSet(): Set<string> {
  const list = useLiveQuery(() => db.notes.toArray(), [])
  return useMemo(() => new Set((list ?? []).map((n) => n.articleId)), [list])
}
