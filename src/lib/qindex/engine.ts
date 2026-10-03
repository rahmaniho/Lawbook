/**
 * موتور جستجوی «فهرست مصوبات» (مستقل از DOM؛ در Web Worker و آزمون‌ها استفاده می‌شود)
 *
 * کلید فشرده همه عنوان‌ها (بدون فاصله/نیم‌فاصله، نرمال‌شده) در یک رشته بزرگ نگه داشته می‌شود و پرس‌وجو با
 * indexOf روی آن اجرا می‌شود: برای ۱۵۰ هزار عنوان بدون ایندکس سنگین، معمولاً ۱۰ تا ۵۰ میلی‌ثانیه.
 */
import { matchKey, matchTokens, Q_TYPE_IDS, Q_TYPES, yearOf, type QIndexChunk, type QType } from './model'
import type { QEntryOut, QSearchParams, QSearchResponse } from './client'

const TYPE_BOOST: Record<QType, number> = { constitution: 120, statute: 100, precedent: 40, regulation: 20, advisory: 10, local: 0, other: 0 }

export class QIndexEngine {
  private n = 0
  private ids: Int32Array
  private years: Int16Array
  private auth: Uint16Array
  private types: Uint8Array
  private titles: string[]
  private dates: string[]
  private S = ''
  private sStart: Int32Array
  private byId = new Map<number, number>()
  private newest: Int32Array | null = null
  private lastKey = ''
  private lastMatches: number[] = []
  private lastCounts: number[] = []
  private lastTook = 0

  constructor(
    chunks: QIndexChunk[],
    private authorities: string[],
    private inApp: Record<string, string> = {},
  ) {
    const total = chunks.reduce((s, c) => s + c.ids.length, 0)
    this.ids = new Int32Array(total)
    this.years = new Int16Array(total)
    this.auth = new Uint16Array(total)
    this.types = new Uint8Array(total)
    this.titles = new Array(total)
    this.dates = new Array(total)
    this.sStart = new Int32Array(total + 1)
    const keys: string[] = new Array(total)
    let k = 0
    let offset = 0
    for (const chunk of chunks) {
      const ti = Q_TYPE_IDS.indexOf(chunk.type)
      for (let j = 0; j < chunk.ids.length; j++, k++) {
        this.ids[k] = chunk.ids[j]
        this.titles[k] = chunk.titles[j]
        this.dates[k] = chunk.dates[j]
        this.years[k] = yearOf(chunk.dates[j])
        this.auth[k] = chunk.auth[j]
        this.types[k] = ti
        this.byId.set(chunk.ids[j], k)
        const key = matchKey(chunk.titles[j])
        keys[k] = key
        this.sStart[k] = offset
        offset += key.length + 1
      }
    }
    this.n = k
    this.sStart[k] = offset
    // جداکننده \u0001 در عنوان‌ها وجود ندارد؛ تطبیق از مرز عنوان‌ها عبور نمی‌کند
    this.S = keys.join('\u0001') + '\u0001'
  }

  get count() {
    return this.n
  }

  /** شماره ردیف مالک موقعیت pos در رشته S (جستجوی دودویی) */
  private entryAt(pos: number): number {
    let lo = 0
    let hi = this.n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.sStart[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  private cmpNewest = (a: number, b: number) =>
    this.years[b] - this.years[a] || (this.dates[a] === this.dates[b] ? this.ids[b] - this.ids[a] : this.dates[a] < this.dates[b] ? 1 : -1)

  private newestOrder(): Int32Array {
    if (!this.newest) {
      const order = Array.from({ length: this.n }, (_, i) => i)
      order.sort(this.cmpNewest)
      this.newest = Int32Array.from(order)
    }
    return this.newest
  }

  private out(i: number): QEntryOut {
    const qid = this.ids[i]
    return {
      id: qid,
      title: this.titles[i],
      date: this.dates[i],
      authority: this.authorities[this.auth[i]] ?? '',
      type: Q_TYPE_IDS[this.types[i]],
      lawId: this.inApp[String(qid)],
    }
  }

  get(qid: number): QEntryOut | null {
    const i = this.byId.get(qid)
    return i == null ? null : this.out(i)
  }

  search(p: QSearchParams): QSearchResponse {
    const t0 = performance.now()
    const q = (p.q ?? '').trim()
    const tokens = matchTokens(q)
    const sort = p.sort ?? (tokens.length ? 'relevance' : 'newest')
    const key = JSON.stringify([tokens, p.types ?? [], p.authority ?? '', p.yearFrom ?? 0, p.yearTo ?? 0, sort])
    const recompute = key !== this.lastKey
    if (recompute) {
      const typeSet = p.types?.length ? new Set(p.types.map((t) => Q_TYPE_IDS.indexOf(t))) : null
      const authIdx = p.authority ? this.authorities.indexOf(p.authority) : -1
      const yf = p.yearFrom ?? 0
      const yt = p.yearTo ?? 0
      const counts = new Array(Q_TYPES.length).fill(0)
      const matches: number[] = []
      if (p.authority && authIdx < 0) {
        // مرجع ناشناخته → بدون نتیجه
      } else {
        const consider = (i: number) => {
          if (authIdx >= 0 && this.auth[i] !== authIdx) return
          if (yf || yt) {
            const y = this.years[i]
            if (!y || (yf && y < yf) || (yt && y > yt)) return
          }
          counts[this.types[i]]++
          if (!typeSet || typeSet.has(this.types[i])) matches.push(i)
        }
        if (!tokens.length) {
          if (sort === 'relevance') for (let i = 0; i < this.n; i++) consider(i)
          else {
            const order = this.newestOrder()
            for (let x = 0; x < this.n; x++) consider(order[x])
            if (sort === 'oldest') matches.reverse()
          }
        } else {
          const [first, ...rest] = tokens
          let pos = this.S.indexOf(first)
          while (pos !== -1) {
            const i = this.entryAt(pos)
            const end = this.sStart[i + 1] - 1
            let ok = true
            if (rest.length) {
              const s = this.S.slice(this.sStart[i], end)
              for (const t of rest) {
                if (!s.includes(t)) {
                  ok = false
                  break
                }
              }
            }
            if (ok) consider(i)
            pos = this.S.indexOf(first, end + 1)
          }
          if (sort === 'relevance') {
            const phrase = matchKey(q)
            const score = new Map<number, number>()
            for (const i of matches) {
              const s = this.S.slice(this.sStart[i], this.sStart[i + 1] - 1)
              let v = TYPE_BOOST[Q_TYPE_IDS[this.types[i]]]
              if (s === phrase) v += 1000
              else if (s.startsWith(phrase)) v += 400
              else if (s.includes(phrase)) v += 150
              else if (s.startsWith(first)) v += 60
              v -= s.length / 8
              v += this.years[i] / 1000
              score.set(i, v)
            }
            matches.sort((a, b) => score.get(b)! - score.get(a)!)
          } else {
            matches.sort(this.cmpNewest)
            if (sort === 'oldest') matches.reverse()
          }
        }
      }
      this.lastKey = key
      this.lastMatches = matches
      this.lastCounts = counts
      this.lastTook = performance.now() - t0
    }
    const offset = p.offset ?? 0
    const limit = p.limit ?? 50
    const byType: Partial<Record<QType, number>> = {}
    this.lastCounts.forEach((c, i) => {
      if (c) byType[Q_TYPE_IDS[i]] = c
    })
    return {
      query: q,
      total: this.lastMatches.length,
      items: this.lastMatches.slice(offset, offset + limit).map((i) => this.out(i)),
      byType,
      tookMs: Math.round((recompute ? this.lastTook : performance.now() - t0) * 10) / 10,
      sort,
    }
  }
}
