import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, m } from 'framer-motion'
import { Search, X, Loader2, BookOpen, ArrowLeft, History, Sparkles } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDebounce } from '../../hooks/useDebounce'
import { useLaws } from '../../hooks/useLaws'
import { searchLaws, useSearchStatus } from '../../lib/search/client'
import { useSettings } from '../../lib/settings'
import { db } from '../../lib/db'
import { addSearchHistory } from '../../lib/history'
import { normalizeSearch, toFaDigits } from '../../lib/normalize'
import { articlePath, cn, lawPath } from '../../lib/utils'
import type { SearchResponse } from '../../lib/types'
import { Highlight } from './Highlight'

/**
 * نوار جستجوی همیشه‌در‌دسترس با نتایج فوری (debounce ۲۰۰ms) در Dropdown بالای صفحه
 */
export function SearchBar({ placeholder = 'جستجو در قوانین… (مثلاً «ماده ۱۰ قانون مدنی» یا «مهریه»)' }: { placeholder?: string }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const status = useSearchStatus()
  const laws = useLaws()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [res, setRes] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const debounced = useDebounce(q, 200)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const history = useLiveQuery(() => db.history.orderBy('timestamp').reverse().limit(5).toArray(), [])

  useEffect(() => {
    const term = debounced.trim()
    if (!term) {
      setRes(null)
      return
    }
    let alive = true
    setLoading(true)
    searchLaws(term, { limit: 6, instant: true, semantic: settings.semanticSearch })
      .then((r) => alive && setRes(r))
      .catch(() => alive && setRes(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [debounced, settings.semanticSearch])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const lawMatches = useMemo(() => {
    const n = normalizeSearch(q).trim()
    if (n.length < 2 || !laws) return []
    return laws
      .filter((l) => [l.title, l.shortTitle, ...l.aliases].some((t) => normalizeSearch(t).includes(n)))
      .slice(0, 2)
  }, [q, laws])

  const submit = (value = q) => {
    const v = value.trim()
    if (!v) return
    void addSearchHistory(v)
    setFocused(false)
    inputRef.current?.blur()
    navigate(`/search?q=${encodeURIComponent(v)}`)
  }

  const open = focused && (q.trim().length > 0 || (history?.length ?? 0) > 0)
  const preparing = status.state === 'building' || status.state === 'loading' || status.state === 'saving'

  return (
    <div ref={boxRef} className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={cn(
          'flex h-12 items-center gap-2 rounded-2xl border bg-surface px-3.5 transition-[border-color,box-shadow]',
          focused ? 'border-brand/60 shadow-float' : 'border-line shadow-soft',
        )}
      >
        <Search className="h-5 w-5 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          enterKeyHint="search"
          inputMode="search"
          aria-label="جستجو در قوانین"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[13px] placeholder:text-muted/80"
        />
        {loading && <Loader2 className="h-4.5 w-4.5 shrink-0 animate-spin text-muted" />}
        {q && (
          <button type="button" aria-label="پاک کردن" onClick={() => setQ('')} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </form>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[70dvh] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1.5 shadow-float"
          >
            {!q.trim() && history && history.length > 0 && (
              <div>
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">جستجوهای اخیر</p>
                {history.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setQ(h.query)
                      submit(h.query)
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm hover:bg-surface-2"
                  >
                    <History className="h-4 w-4 text-muted" />
                    <span className="truncate">{h.query}</span>
                  </button>
                ))}
              </div>
            )}

            {q.trim() && (
              <>
                {preparing && (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    در حال آماده‌سازی ایندکس جستجو…
                  </div>
                )}
                {lawMatches.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setFocused(false)
                      navigate(lawPath(l.id))
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-surface-2"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                      <BookOpen className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.title}</span>
                      <span className="block text-xs text-muted">
                        {l.available ? `${toFaDigits(l.stats.articles)} ${l.unit}` : 'در انتظار ورود متن'}
                      </span>
                    </span>
                  </button>
                ))}
                {res?.expandedWith && res.expandedWith.length > 0 && (
                  <p className="flex items-center gap-1.5 px-3 pt-1.5 text-[11.5px] text-muted">
                    <Sparkles className="h-3.5 w-3.5 text-accent" /> شامل مفاهیم: {res.expandedWith.join('، ')}
                  </p>
                )}
                {res?.hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      void addSearchHistory(q)
                      setFocused(false)
                      navigate(articlePath(h.lawId, h.key))
                    }}
                    className="block w-full rounded-xl px-3 py-2.5 text-start hover:bg-surface-2"
                  >
                    <span className="mb-0.5 flex items-center gap-2 text-[13px]">
                      <span className="font-bold text-brand-strong">{toFaDigits(h.label)}</span>
                      <span className="truncate text-muted">{h.lawTitle}</span>
                      {h.status === 'منسوخ' && <span className="text-[11px] text-danger">منسوخ</span>}
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-6 text-fg/85">
                      <Highlight text={h.snippet} terms={h.terms} persian={settings.persianDigits} />
                    </span>
                  </button>
                ))}
                {res && !res.hits.length && !preparing && !lawMatches.length && (
                  <p className="px-3 py-4 text-center text-sm text-muted">نتیجه‌ای یافت نشد.</p>
                )}
                {res && res.total > 0 && (
                  <button
                    type="button"
                    onClick={() => submit()}
                    className="mt-1 flex w-full items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-medium"
                  >
                    <span>
                      مشاهده همه نتایج ({toFaDigits(res.total)}) — {toFaDigits(res.tookMs)} میلی‌ثانیه
                    </span>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
