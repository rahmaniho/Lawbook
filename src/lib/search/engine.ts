/**
 * موتور جستجوی چندلایه (در Web Worker اجرا می‌شود؛ مستقل از DOM و IndexedDB برای تست‌پذیری)
 *
 * لایه ۱: شماره ماده/اصل (دسترسی مستقیم)
 * لایه ۲: کلیدواژه با رتبه‌بندی BM25 و وزن‌دهی فیلدها
 * لایه ۳: عبارت دقیق (داخل گیومه یا تطبیق کامل عبارت → امتیاز بیشتر)
 * لایه ۴: فازی (تحمل غلط تایپی) و پیشوندی (جستجوی حین تایپ)
 * لایه ۵: جستجوی مفهومی سبک (گسترش پرس‌وجو با واژه‌نامه مفاهیم حقوقی و هم‌معناها)
 */
import MiniSearch, { type Options, type SearchResult } from 'minisearch'
import { normalizeSearch, processTerm, searchTerms, tokenize } from '../normalize'
import type { Article, DocGroup, GlossaryConcept, SearchFilters } from '../types'
import { LawResolver, parseQuery, articleKeyFrom, type LawAliasInfo, type ParsedQuery } from './query'

export const ENGINE_VERSION = 'e3'

export interface IndexDoc {
  id: string
  label: string
  lawTitle: string
  chapter: string
  text: string
  notes: string
  kw: string
  lawId: string
  status: string
  category: string
  docType: string
  approvalYear: number
}

const DOC_GROUPS: Record<DocGroup, string[]> = {
  law: ['قانون اساسی', 'قانون', 'لایحه قانونی'],
  regulation: ['آیین‌نامه', 'تصویب‌نامه', 'مصوبه شورا'],
  ruling: ['رأی وحدت رویه', 'نظریه مشورتی'],
}

export const MINISEARCH_OPTIONS: Options<IndexDoc> = {
  idField: 'id',
  fields: ['label', 'lawTitle', 'chapter', 'text', 'notes', 'kw'],
  storeFields: ['lawId', 'status', 'category', 'docType', 'approvalYear'],
  tokenize: (text) => tokenize(text),
  processTerm: (term) => processTerm(term) as string | string[] | null,
}

export function toIndexDoc(a: Article): IndexDoc {
  return {
    id: a.id,
    label: a.label,
    lawTitle: a.lawTitle,
    chapter: [a.section, a.chapter].filter(Boolean).join(' '),
    text: a.text,
    notes: (a.notes ?? []).join('\n'),
    kw: a.keywords.join(' '),
    lawId: a.lawId,
    status: a.status,
    category: a.category,
    docType: a.docType,
    approvalYear: a.approvalYear ?? 0,
  }
}

export interface EngineHit {
  id: string
  score: number
  exact?: boolean
  terms: string[]
}

export interface EngineResult {
  parsed: ParsedQuery
  hits: EngineHit[]
  total: number
  expandedWith: string[]
}

export interface SearchOpts {
  filters?: SearchFilters
  limit?: number
  semantic?: boolean
  instant?: boolean
}

export class LawSearchEngine {
  mini: MiniSearch<IndexDoc>
  private resolver: LawResolver = new LawResolver([])
  private lawPriority = new Map<string, number>()
  private keys = new Set<string>()
  private byNumber = new Map<string, string[]>()
  private concepts: { term: string; triggers: string[]; expansions: string[] }[] = []
  private conceptHighlights = new Map<string, string[]>()

  constructor(mini?: MiniSearch<IndexDoc>) {
    this.mini = mini ?? new MiniSearch<IndexDoc>(MINISEARCH_OPTIONS)
  }

  static fromJSON(json: string) {
    return new LawSearchEngine(MiniSearch.loadJSON<IndexDoc>(json, MINISEARCH_OPTIONS))
  }

  toJSON(): string {
    return JSON.stringify(this.mini)
  }

  addAll(articles: Article[]) {
    this.mini.addAll(articles.map(toIndexDoc))
  }

  /** ثبت شناسه‌ها برای دسترسی مستقیم به شماره ماده */
  setArticleKeys(ids: string[]) {
    this.keys = new Set(ids)
    this.byNumber.clear()
    for (const id of ids) {
      const key = id.slice(id.indexOf(':') + 1)
      const list = this.byNumber.get(key)
      if (list) list.push(id)
      else this.byNumber.set(key, [id])
    }
  }

  setLaws(laws: LawAliasInfo[]) {
    this.resolver = new LawResolver(laws)
    this.lawPriority = new Map(laws.map((l) => [l.id, l.priority]))
  }

  setGlossary(concepts: GlossaryConcept[]) {
    this.conceptHighlights.clear()
    for (const c of concepts) {
      const hl = [...new Set(c.match.flatMap((p) => searchTerms(p)))]
      for (const t of searchTerms(c.term)) this.conceptHighlights.set(t, [...(this.conceptHighlights.get(t) ?? []), ...hl])
    }
    this.concepts = concepts.map((c) => ({
      term: c.term,
      triggers: [...c.match, ...c.expand, c.term].map((p) => ` ${tokenize(p).join(' ')} `).filter((p) => p.trim()),
      expansions: [...new Set([c.term, ...c.match])],
    }))
  }

  resolveLaw(hint: string) {
    return this.resolver.resolve(hint)
  }

  /** واژه‌هایی که از طریق کلیدواژه مفهومی تطبیق خورده‌اند، با عبارات متنی همان مفهوم هایلایت می‌شوند */
  highlightTerms(terms: string[]): string[] {
    const out = new Set(terms)
    for (const t of terms) for (const h of this.conceptHighlights.get(t) ?? []) out.add(h)
    return [...out]
  }

  private filterFn(filters?: SearchFilters) {
    if (!filters) return undefined
    const cats = filters.categories?.length ? new Set(filters.categories) : null
    const sts = filters.statuses?.length ? new Set(filters.statuses) : null
    const laws = filters.lawIds?.length ? new Set(filters.lawIds) : null
    const docTypes = filters.docGroups?.length ? new Set(filters.docGroups.flatMap((g) => DOC_GROUPS[g])) : null
    const yFrom = filters.yearFrom
    const yTo = filters.yearTo
    if (!cats && !sts && !laws && !docTypes && !yFrom && !yTo) return undefined
    return (r: SearchResult) => {
      if (cats && !cats.has(r.category)) return false
      if (sts && !sts.has(r.status)) return false
      if (laws && !laws.has(r.lawId)) return false
      if (docTypes && !docTypes.has(r.docType)) return false
      if (yFrom && (r.approvalYear || 0) < yFrom) return false
      if (yTo && (r.approvalYear || 9999) > yTo) return false
      return true
    }
  }

  private docBoost = (_id: string, _term: string, stored?: Record<string, unknown>) => {
    const p = this.lawPriority.get(String(stored?.lawId)) ?? 50
    let b = 1 + (p - 50) / 250
    if (stored?.status === 'منسوخ') b *= 0.55
    return b
  }

  /** مفاهیمی که در پرس‌وجو آمده‌اند */
  detectConcepts(normalizedQuery: string) {
    const q = ` ${tokenize(normalizedQuery).join(' ')} `
    return this.concepts.filter((c) => c.triggers.some((t) => q.includes(t)))
  }

  search(query: string, opts: SearchOpts = {}): EngineResult {
    const parsed = parseQuery(query, this.resolver)
    const limit = opts.limit ?? 50
    const filter = this.filterFn(opts.filters)
    const hits: EngineHit[] = []
    const seen = new Set<string>()
    let expandedWith: string[] = []

    // لایه ۱: شماره ماده
    if (parsed.kind === 'article' && parsed.article) {
      const key = articleKeyFrom(parsed.article.number, parsed.article.suffix)
      const lawId = parsed.article.lawId
      const candidates = lawId ? [`${lawId}:${key}`] : (this.byNumber.get(key) ?? [])
      const unit = parsed.article.unit
      const ranked = candidates
        .filter((id) => this.keys.has(id))
        .filter((id) => !unit || lawId || (unit === 'اصل') === (this.resolver.unitOf(id.slice(0, id.indexOf(':'))) === 'اصل'))
        .sort((a, b) => (this.lawPriority.get(b.split(':')[0]) ?? 0) - (this.lawPriority.get(a.split(':')[0]) ?? 0))
      for (const id of ranked) {
        if (filter) {
          const stored = this.mini.getStoredFields(id) as SearchResult | undefined
          if (stored && !filter({ ...stored, id, score: 0, terms: [], queryTerms: [], match: {} } as SearchResult)) continue
        }
        hits.push({ id, score: 1e6 - hits.length, exact: true, terms: [] })
        seen.add(id)
      }
      // ادامه: جستجوی متنی باقیمانده (مثلاً «ماده ۱۰ قانون مدنی قرارداد»)
      if (!parsed.terms.length) return { parsed, hits, total: hits.length, expandedWith }
    }

    const text = parsed.kind === 'phrase' ? (parsed.phrase ?? '') : parsed.kind === 'article' ? parsed.terms.join(' ') : parsed.normalized
    const terms = searchTerms(text)
    if (!terms.length) return { parsed, hits, total: hits.length, expandedWith }

    const lastIdx = tokenize(text).length - 1
    const base = {
      boost: { label: 3, kw: 2, chapter: 1.2, lawTitle: 0.8, text: 1, notes: 0.9 },
      boostDocument: this.docBoost,
      filter,
      prefix: (term: string, i: number) => (opts.instant ? i === lastIdx && term.length >= 2 : term.length >= 3),
      fuzzy: (term: string) => (parsed.kind === 'phrase' ? false : term.length >= 5 ? 0.2 : term.length >= 4 ? 0.15 : false),
    }

    let results = this.mini.search(text, { ...base, combineWith: 'AND' })
    if (results.length < 3 && terms.length > 1 && parsed.kind !== 'phrase') {
      const or = this.mini.search(text, { ...base, combineWith: 'OR' })
      const have = new Set(results.map((r) => r.id))
      results = results.concat(or.filter((r) => !have.has(r.id)).map((r) => ({ ...r, score: r.score * 0.5 })))
    }

    // لایه ۵: گسترش مفهومی
    if (opts.semantic) {
      const concepts = this.detectConcepts(text)
      if (concepts.length) {
        expandedWith = concepts.map((c) => c.term)
        const expansionQuery = concepts.flatMap((c) => c.expansions).join(' ')
        const extra = this.mini.search(expansionQuery, { ...base, fuzzy: false, prefix: false, combineWith: 'OR' })
        const have = new Map(results.map((r) => [r.id, r]))
        for (const r of extra) {
          const prev = have.get(r.id)
          if (prev) prev.score += r.score * 0.3
          else results.push({ ...r, score: r.score * 0.45 })
        }
      }
    }

    // لایه ۳: امتیاز عبارت دقیق
    const phrase = normalizeSearch(text)
    const usePhrase = terms.length > 1 || parsed.kind === 'phrase'
    results.sort((a, b) => b.score - a.score)
    for (const r of results) {
      if (seen.has(r.id)) continue
      hits.push({ id: r.id, score: r.score, terms: r.terms })
      seen.add(r.id)
    }
    const total = hits.length
    return { parsed, hits: hits.slice(0, Math.max(limit * 3, limit)), total, expandedWith, ...(usePhrase ? { phrase } : {}) } as EngineResult & {
      phrase?: string
    }
  }
}
