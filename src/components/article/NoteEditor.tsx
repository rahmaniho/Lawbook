import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, StickyNote, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { relativeTime } from '../../lib/format'

/** یادداشت شخصی برای هر ماده — فقط روی همین دستگاه ذخیره می‌شود */
export function NoteEditor({ articleId }: { articleId: string }) {
  const note = useLiveQuery(() => db.notes.where('articleId').equals(articleId).first(), [articleId])
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const loaded = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    loaded.current = false
  }, [articleId])

  useEffect(() => {
    if (note !== undefined && !loaded.current) {
      setText(note?.text ?? '')
      loaded.current = true
    }
    if (note === undefined && !loaded.current) {
      // هنوز بارگذاری نشده
    }
  }, [note])

  const save = (value: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const existing = await db.notes.where('articleId').equals(articleId).first()
      const now = Date.now()
      if (!value.trim()) {
        if (existing) await db.notes.delete(existing.id!)
      } else if (existing) await db.notes.update(existing.id!, { text: value, updatedAt: now })
      else await db.notes.add({ articleId, text: value, createdAt: now, updatedAt: now })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 500)
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2">
        <StickyNote className="h-4.5 w-4.5 text-accent" />
        <h2 className="font-bold">یادداشت شخصی</h2>
        <span className="ms-auto flex items-center gap-1 text-[11.5px] text-muted">
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5 text-ok" /> ذخیره شد
            </>
          ) : note?.updatedAt ? (
            relativeTime(note.updatedAt)
          ) : (
            'فقط روی این دستگاه'
          )}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          save(e.target.value)
        }}
        rows={3}
        placeholder="برداشت، نکته یا ارجاع خود را بنویسید…"
        className="w-full resize-y rounded-xl border border-line bg-surface-2/50 p-3 text-[14.5px] leading-7 outline-none focus:border-brand/60"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('')
            save('')
          }}
          className="mt-1 flex items-center gap-1 text-[12px] text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" /> حذف یادداشت
        </button>
      )}
    </section>
  )
}
