/**
 * تحلیل پرس‌وجو: تشخیص جستجوی «شماره ماده» (مثل «ماده ۱۰ قانون مدنی»، «اصل ۴۴»، «م ۱۰ ق.م»،
 * «مدنی ۱۰»)، عبارت دقیق (داخل گیومه) و کلیدواژه.
 */
import { normalizeSearch, searchTerms } from '../normalize'

export interface LawAliasInfo {
  id: string
  title: string
  shortTitle: string
  aliases: string[]
  unit: string
  priority: number
  /**
   * قانونی که متنش با شماره‌گذاری دیگری در قانون دیگری درج شده است؛ مثلاً مواد ۱ تا ۵۶ «قانون جرایم رایانه‌ای»
   * = مواد ۷۲۹ تا ۷۸۴ کتاب پنجم قانون مجازات اسلامی (طبق ماده ۷۸۳ همان متن).
   */
  redirect?: { lawId: string; offset: number; max: number }
}

export interface ParsedQuery {
  raw: string
  normalized: string
  kind: 'article' | 'phrase' | 'keyword' | 'empty'
  article?: {
    unit?: string
    number: number
    suffix?: string
    lawId?: string
    lawHint?: string
    /** شماره و قانون اصلی پیش از نگاشت (برای نمایش «ماده ۱ قانون جرایم رایانه‌ای = ماده ۷۲۹ …») */
    redirectedFrom?: { lawId: string; number: number }
  }
  phrase?: string
  terms: string[]
}

const UNIT_RE = '(ماده|مواد|م|اصل|اصول)'

function stripLawWord(s: string) {
  return s
    .replace(/^(قانون|ق)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v)
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
    cur = []
  }
  return prev[b.length]
}

export class LawResolver {
  private entries: { id: string; key: string; priority: number }[] = []
  private units = new Map<string, string>()
  private redirects = new Map<string, NonNullable<LawAliasInfo['redirect']>>()

  constructor(laws: LawAliasInfo[]) {
    for (const l of laws) {
      this.units.set(l.id, l.unit)
      if (l.redirect) this.redirects.set(l.id, l.redirect)
      const names = new Set<string>([l.title, l.shortTitle, ...l.aliases])
      for (const n of names) {
        const k = normalizeSearch(n).replace(/\s+/g, ' ').trim()
        if (!k) continue
        this.entries.push({ id: l.id, key: k, priority: l.priority })
        const stripped = stripLawWord(k)
        if (stripped && stripped !== k) this.entries.push({ id: l.id, key: stripped, priority: l.priority })
      }
    }
    // کلیدهای بلندتر اول
    this.entries.sort((a, b) => b.key.length - a.key.length || b.priority - a.priority)
  }

  unitOf(id: string) {
    return this.units.get(id)
  }

  redirectOf(id: string) {
    return this.redirects.get(id)
  }

  /** یافتن قانون از روی بخشی از عنوان/نام مستعار */
  resolve(hint: string): string | undefined {
    const h = normalizeSearch(hint).replace(/\s+/g, ' ').trim()
    if (!h) return undefined
    const hs = stripLawWord(h)
    for (const e of this.entries) if (e.key === h || e.key === hs) return e.id
    // پیشوند/شامل (فقط برای راهنمای ≥۳ حرف)
    if (hs.length >= 3) {
      for (const e of this.entries) if (e.key.startsWith(hs)) return e.id
      for (const e of this.entries) if (hs.length >= 4 && e.key.includes(hs)) return e.id
      // تحمل غلط تایپی
      let best: { id: string; d: number; p: number } | undefined
      for (const e of this.entries) {
        if (e.key.length < 4) continue
        const d = levenshtein(hs, e.key, 1)
        if (d <= 1 && (!best || d < best.d || (d === best.d && e.priority > best.p))) best = { id: e.id, d, p: e.priority }
      }
      if (best) return best.id
    }
    return undefined
  }
}

export function parseQuery(raw: string, resolver?: LawResolver): ParsedQuery {
  const trimmed = raw.trim()
  const normalized = normalizeSearch(trimmed).replace(/\s+/g, ' ')
  if (!normalized) return { raw, normalized, kind: 'empty', terms: [] }

  // عبارت دقیق: «…» یا "…"
  const quoted = normalized.match(/^["«“](.+?)["»”]$/)
  if (quoted) {
    const phrase = quoted[1].trim()
    return { raw, normalized, kind: 'phrase', phrase, terms: searchTerms(phrase) }
  }

  const tryArticle = (num: string, suffixRaw: string | undefined, unit: string | undefined, hint: string) => {
    const number = parseInt(num, 10)
    if (!Number.isFinite(number) || number <= 0 || number > 5000) return undefined
    const lawId = hint ? resolver?.resolve(hint) : undefined
    if (hint && !lawId && !unit) return undefined
    let suffix: string | undefined
    if (suffixRaw) {
      const m = suffixRaw.match(/مکرر\s*(\d+)?/)
      suffix = m ? `مکرر${m[1] ? ' ' + m[1] : ''}` : undefined
    }
    const u = unit ? (unit.startsWith('اصل') || unit === 'اصول' ? 'اصل' : 'ماده') : undefined
    const redirect = lawId ? resolver?.redirectOf(lawId) : undefined
    if (lawId && redirect) {
      // شماره‌های قانون اصلی (۱ تا max) به شماره درج‌شده نگاشت می‌شوند؛ شماره‌های بزرگ‌تر همان شماره قانون مقصدند
      const mapped = number <= redirect.max ? number + redirect.offset : number
      return { unit: u, number: mapped, suffix, lawId: redirect.lawId, lawHint: hint || undefined, ...(mapped !== number ? { redirectedFrom: { lawId, number } } : {}) }
    }
    return { unit: u, number, suffix, lawId: lawId ?? (u === 'اصل' && !hint ? 'constitution' : undefined), lawHint: hint || undefined }
  }

  // «ماده 10 قانون مدنی» / «م.10 ق.م» / «اصل 44»
  let m = normalized.match(new RegExp(`^${UNIT_RE}\\s*\\.?\\s*(\\d+)(\\s*مکرر(?:\\s*\\d+)?)?\\s*(.*)$`))
  if (m) {
    const hint = m[4]?.trim() ?? ''
    const art = tryArticle(m[2], m[3], m[1], hint)
    // اگر بخش متنی به یک قانون اشاره داشت، جزو واژه‌های جستجو نیست
    if (art) return { raw, normalized, kind: 'article', article: art, terms: art.lawId && hint ? [] : searchTerms(hint) }
  }
  // «قانون مدنی ماده 10»
  m = normalized.match(new RegExp(`^(.+?)\\s+${UNIT_RE}\\s*\\.?\\s*(\\d+)(\\s*مکرر(?:\\s*\\d+)?)?$`))
  if (m) {
    const art = tryArticle(m[3], m[4], m[2], m[1].trim())
    if (art) return { raw, normalized, kind: 'article', article: art, terms: [] }
  }
  // «مدنی 10» یا «10 مدنی» (فقط اگر بخش متنی یک قانون باشد)
  m = normalized.match(/^(\d+)(\s*مکرر(?:\s*\d+)?)?\s+(.+)$/) ?? null
  if (m) {
    const art = tryArticle(m[1], m[2], undefined, m[3].trim())
    if (art?.lawId) return { raw, normalized, kind: 'article', article: art, terms: [] }
  }
  m = normalized.match(/^(.+?)\s+(\d+)(\s*مکرر(?:\s*\d+)?)?$/) ?? null
  if (m) {
    const art = tryArticle(m[2], m[3], undefined, m[1].trim())
    if (art?.lawId) return { raw, normalized, kind: 'article', article: art, terms: [] }
  }

  return { raw, normalized, kind: 'keyword', terms: searchTerms(normalized) }
}

export function articleKeyFrom(number: number, suffix?: string): string {
  if (!suffix) return String(number)
  const m = suffix.match(/مکرر(?:\s+(\d+))?/)
  return `${number}-bis${m?.[1] ?? ''}`
}
