/**
 * ساخت بسته‌های «فهرست مصوبات» (نمایه عناوین سامانه ملی قوانین) برای PWA
 *
 * ورودی:  data/raw/qavanin-index/qavanin-list.tsv.gz   (عناوین عیناً مطابق منبع)
 * خروجی:  public/data/qindex/manifest.json
 *         public/data/qindex/<type>.<n>.<hash>.json      بسته‌های ستونی ≤ ~۵۰۰KB
 *
 * عنوان‌ها فقط نرمال‌سازی نگارشی می‌شوند (normalizeDisplay: ی/ک عربی، نیم‌فاصله، ارقام)؛ هیچ واژه‌ای تغییر نمی‌کند.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { normalizeDisplay, toLatinDigits } from '../../src/lib/normalize.ts'
import {
  classifyEntry,
  Q_TYPE_IDS,
  QAVANIN_LAW_URL,
  yearOf,
  type QIndexChunk,
  type QIndexManifest,
  type QIndexSummary,
  type QType,
} from '../../src/lib/qindex/model.ts'

const CHUNK_LIMIT = 490 * 1024
const short = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 10)

interface Row {
  id: number
  title: string
  date: string
  authority: string
  type: QType
  year: number
}

export interface QIndexBuildResult {
  summary: QIndexSummary
  manifest: QIndexManifest
}

/** مرتب‌سازی جدیدترین اول (تاریخ‌های نامعتبر در انتها) */
function byNewest(a: Row, b: Row) {
  if (a.year !== b.year) return b.year - a.year
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return b.id - a.id
}

export function buildQIndex(root: string, outDir: string, inApp: Record<string, string>): QIndexBuildResult | null {
  const src = join(root, 'data', 'raw', 'qavanin-index', 'qavanin-list.tsv.gz')
  if (!existsSync(src)) {
    console.warn('⚠ فهرست عناوین سامانه یافت نشد؛ «فهرست مصوبات» ساخته نشد.')
    return null
  }
  const text = gunzipSync(readFileSync(src)).toString('utf8')
  const lines = text.split('\n')
  const header = lines[0].split('\t')
  if (header.join(',') !== 'id,title,approval_date,approval_authority') throw new Error(`سرستون نامعتبر: ${header}`)

  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const [id, rawTitle = '', rawDate = '', rawAuth = ''] = line.split('\t')
    const title = normalizeDisplay(rawTitle).replace(/\n/g, ' ')
    const authority = normalizeDisplay(rawAuth).replace(/\n/g, ' ')
    const date = toLatinDigits(rawDate.trim())
    rows.push({ id: Number(id), title, date, authority, type: classifyEntry(title, authority), year: yearOf(date) })
  }

  // مراجع تصویب به ترتیب فراوانی (شاخص کوچک‌تر = فایل کوچک‌تر)
  const authCount = new Map<string, number>()
  for (const r of rows) authCount.set(r.authority, (authCount.get(r.authority) ?? 0) + 1)
  const authorities = [...authCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fa')).map(([a]) => a)
  const authIndex = new Map(authorities.map((a, i) => [a, i]))

  const dir = join(outDir, 'qindex')
  mkdirSync(dir, { recursive: true })
  const types: QIndexManifest['types'] = []
  const byType: QIndexSummary['byType'] = {}
  let totalBytes = 0
  let transferBytes = 0
  const allHashes: string[] = []

  for (const type of Q_TYPE_IDS) {
    const group = rows.filter((r) => r.type === type).sort(byNewest)
    if (!group.length) continue
    byType[type] = group.length
    const chunks: QIndexManifest['types'][number]['chunks'] = []
    let cur: Row[] = []
    let bytes = 0
    const flush = () => {
      if (!cur.length) return
      const chunk: QIndexChunk = {
        type,
        ids: cur.map((r) => r.id),
        titles: cur.map((r) => r.title),
        dates: cur.map((r) => r.date),
        auth: cur.map((r) => authIndex.get(r.authority)!),
      }
      const body = JSON.stringify(chunk)
      const hash = short(body)
      const file = `qindex/${type}.${String(chunks.length).padStart(2, '0')}.${hash}.json`
      writeFileSync(join(outDir, file), body)
      const size = Buffer.byteLength(body)
      chunks.push({ file, hash, count: cur.length, bytes: size })
      totalBytes += size
      transferBytes += gzipSync(body, { level: 6 }).length
      allHashes.push(hash)
      cur = []
      bytes = 0
    }
    for (const r of group) {
      const b = Buffer.byteLength(r.title) + r.date.length + String(r.id).length + 12
      if (bytes + b > CHUNK_LIMIT && cur.length) flush()
      cur.push(r)
      bytes += b
    }
    flush()
    types.push({ id: type, count: group.length, chunks })
  }

  const validDates = rows.filter((r) => r.year > 0 && /^\d{4}\/\d{2}\/\d{2}$/.test(r.date)).map((r) => r.date)
  const latestDate = validDates.reduce((m, d) => (d > m ? d : m), '')
  const earliestYear = rows.reduce((m, r) => (r.year && r.year < m ? r.year : m), 9999)
  const summary: QIndexSummary = {
    count: rows.length,
    latestDate,
    earliestYear,
    byType,
    bytes: totalBytes,
    transferBytes,
    version: short(allHashes.join(',')),
  }
  const manifest: QIndexManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ...summary,
    linkTemplate: QAVANIN_LAW_URL,
    source: {
      name: 'سامانه ملی قوانین و مقررات جمهوری اسلامی ایران',
      url: 'https://qavanin.ir',
      via: 'github.com/fatemeq/standard@ade1c0e (abdal crawler)',
      file: 'data/raw/qavanin-index/qavanin-list.tsv.gz',
    },
    types,
    authorities,
    authorityCounts: authorities.map((a) => authCount.get(a)!),
    inApp,
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  return { summary, manifest }
}
