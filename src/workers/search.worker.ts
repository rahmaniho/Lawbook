/**
 * Web Worker جستجو و ایندکس‌سازی
 * - ایندکس MiniSearch را از IndexedDB بارگذاری می‌کند (یا در صورت نبود، می‌سازد و ذخیره می‌کند)
 * - پرس‌وجوها را بدون مسدود کردن رشته اصلی رابط کاربری پاسخ می‌دهد
 */
import { db, getMeta } from '../lib/db'
import { META_KEY, GLOSSARY_KEY, installDataset, updateDataset } from '../lib/data/sync'
import { buildHighlightRegex, normalizeSearch, searchTerms } from '../lib/normalize'
import { ENGINE_VERSION, LawSearchEngine } from '../lib/search/engine'
import type { Article, DatasetMeta, GlossaryConcept, SearchFilters, SearchHit, SearchResponse } from '../lib/types'

type InMsg =
  | { id: number; type: 'init' }
  | { id: number; type: 'reset' }
  | { id: number; type: 'install' }
  | { id: number; type: 'update' }
  | {
      id: number
      type: 'search'
      query: string
      filters?: SearchFilters
      limit?: number
      semantic?: boolean
      instant?: boolean
    }

interface WorkerScope {
  postMessage(msg: unknown): void
  addEventListener(type: 'message', fn: (e: MessageEvent<InMsg>) => void): void
}
const ctx = self as unknown as WorkerScope

let engine: LawSearchEngine | null = null
let enginePromise: Promise<LawSearchEngine | null> | null = null
let readyInfo: { count: number; source: 'cache' | 'built' | 'empty'; ms: number } | null = null

function post(msg: unknown) {
  ctx.postMessage(msg)
}

async function loadEngine(): Promise<LawSearchEngine | null> {
  const t0 = performance.now()
  const meta = await getMeta<DatasetMeta>(META_KEY)
  if (!meta?.complete) {
    readyInfo = { count: 0, source: 'empty', ms: 0 }
    return null
  }
  const version = `${ENGINE_VERSION}:${meta.fingerprint}`
  let eng: LawSearchEngine | null = null
  let source: 'cache' | 'built' = 'cache'
  try {
    const cached = await db.searchIndex.get('main')
    if (cached && cached.version === version) {
      post({ type: 'progress', phase: 'loading' })
      eng = LawSearchEngine.fromJSON(cached.json)
    }
  } catch {
    eng = null
  }
  if (!eng) {
    source = 'built'
    post({ type: 'progress', phase: 'building' })
    eng = new LawSearchEngine()
    const articles = await db.articles.toArray()
    // ایندکس‌سازی دسته‌ای تا پیشرفت گزارش شود
    const batch = 800
    for (let i = 0; i < articles.length; i += batch) {
      eng.addAll(articles.slice(i, i + batch))
      post({ type: 'progress', phase: 'building', loaded: Math.min(i + batch, articles.length), total: articles.length })
    }
    post({ type: 'progress', phase: 'saving' })
    try {
      await db.searchIndex.put({ key: 'main', version, json: eng.toJSON(), createdAt: Date.now() })
    } catch {
      // فضای ذخیره‌سازی کافی نیست؛ ایندکس در حافظه می‌ماند
    }
  }
  const laws = (await db.laws.toArray()).filter((l) => l.available)
  eng.setLaws(laws.map((l) => ({ id: l.id, title: l.title, shortTitle: l.shortTitle, aliases: l.aliases, unit: l.unit, priority: l.priority })))
  eng.setGlossary((await getMeta<GlossaryConcept[]>(GLOSSARY_KEY)) ?? [])
  eng.setArticleKeys((await db.articles.toCollection().primaryKeys()) as string[])
  readyInfo = { count: eng.mini.documentCount, source, ms: Math.round(performance.now() - t0) }
  return eng
}

function ensureEngine() {
  if (!enginePromise) {
    enginePromise = loadEngine().then((e) => {
      engine = e
      return e
    })
  }
  return enginePromise
}

function snippetOf(a: Article, terms: string[], maxLen = 190) {
  const full = [a.text, ...(a.notes ?? [])].join(' • ').replace(/\s*\n\s*/g, ' ')
  const re = buildHighlightRegex(terms)
  let start = 0
  if (re) {
    const m = re.exec(full)
    if (m && m.index > 50) start = m.index - 50
  }
  if (start > 0) {
    const sp = full.indexOf(' ', start)
    if (sp > 0 && sp - start < 20) start = sp + 1
  }
  const end = Math.min(full.length, start + maxLen)
  let s = full.slice(start, end)
  if (end < full.length) {
    const sp = s.lastIndexOf(' ')
    if (sp > maxLen - 30) s = s.slice(0, sp)
  }
  return (start > 0 ? '… ' : '') + s + (end < full.length ? ' …' : '')
}

async function runSearch(msg: Extract<InMsg, { type: 'search' }>): Promise<SearchResponse> {
  const eng = await ensureEngine()
  if (!eng) return { query: msg.query, hits: [], total: 0, tookMs: 0, kind: 'empty' }
  // زمان جستجو بدون زمان بارگذاری اولیه ایندکس اندازه‌گیری می‌شود
  const t0 = performance.now()
  const limit = msg.limit ?? 30
  const res = eng.search(msg.query, { filters: msg.filters, limit, semantic: msg.semantic, instant: msg.instant })
  const candidates = res.hits.slice(0, Math.max(limit * 3, 60))
  const docs = await db.articles.bulkGet(candidates.map((h) => h.id))
  const queryTerms =
    res.parsed.kind === 'phrase' ? searchTerms(res.parsed.phrase ?? '') : res.parsed.kind === 'article' ? res.parsed.terms : res.parsed.terms
  const phrase =
    res.parsed.kind === 'phrase'
      ? normalizeSearch(res.parsed.phrase ?? '')
      : queryTerms.length > 1
        ? normalizeSearch(res.parsed.kind === 'article' ? res.parsed.terms.join(' ') : res.parsed.normalized)
        : ''

  let scored: { hit: (typeof candidates)[number]; doc: Article; score: number }[] = []
  candidates.forEach((hit, i) => {
    const doc = docs[i]
    if (!doc) return
    let score = hit.score
    if (phrase && !hit.exact) {
      const hay = normalizeSearch(doc.text + ' ' + (doc.notes ?? []).join(' '))
      const has = hay.includes(phrase)
      if (res.parsed.kind === 'phrase' && !has) return
      if (has) score *= 1.8
    }
    scored.push({ hit, doc, score })
  })
  scored.sort((a, b) => (b.hit.exact ? 1 : 0) - (a.hit.exact ? 1 : 0) || b.score - a.score)
  const total = res.parsed.kind === 'phrase' ? scored.length : res.total
  scored = scored.slice(0, limit)

  const hits: SearchHit[] = scored.map(({ hit, doc, score }) => {
    const terms = eng.highlightTerms([...new Set([...hit.terms, ...queryTerms])])
    return {
      id: doc.id,
      lawId: doc.lawId,
      lawTitle: doc.lawTitle,
      label: doc.label,
      key: doc.key,
      score,
      exact: hit.exact,
      status: doc.status,
      snippet: snippetOf(doc, terms),
      terms,
      chapter: doc.chapter,
    }
  })
  const kind = res.parsed.kind === 'empty' ? 'empty' : res.parsed.kind
  return {
    query: msg.query,
    hits,
    total,
    tookMs: Math.round((performance.now() - t0) * 10) / 10,
    kind,
    parsed: res.parsed.article
      ? {
          number: res.parsed.article.number,
          suffix: res.parsed.article.suffix,
          lawId: res.parsed.article.lawId,
          unit: res.parsed.article.unit,
        }
      : undefined,
    expandedWith: res.expandedWith,
  }
}

ctx.addEventListener('message', async (e: MessageEvent<InMsg>) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      await ensureEngine()
      post({ id: msg.id, type: 'ready', info: readyInfo })
    } else if (msg.type === 'reset') {
      engine = null
      enginePromise = null
      await ensureEngine()
      post({ id: msg.id, type: 'ready', info: readyInfo })
    } else if (msg.type === 'install' || msg.type === 'update') {
      // دریافت و نوشتن داده‌ها خارج از رشته اصلی (بدون مسدود کردن رابط کاربری)
      const onProgress = (progress: unknown) => post({ id: msg.id, type: 'data-progress', progress })
      const result = msg.type === 'install' ? await installDataset(onProgress) : await updateDataset(onProgress)
      const changed = msg.type === 'install' || (result as { updated?: boolean }).updated
      if (changed) {
        engine = null
        enginePromise = null
      }
      post({ id: msg.id, type: 'done', result })
      // ساخت/بارگذاری ایندکس پس از تغییر داده‌ها
      void ensureEngine().then(() => post({ type: 'ready', info: readyInfo }))
    } else if (msg.type === 'search') {
      const response = await runSearch(msg)
      post({ id: msg.id, type: 'result', response })
    }
  } catch (err) {
    post({ id: msg.id, type: 'error', error: err instanceof Error ? err.message : String(err) })
  }
})

void engine
