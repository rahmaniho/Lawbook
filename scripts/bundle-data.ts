/**
 * بسته‌بندی داده‌های قوانین برای PWA
 *
 * ورودی:  data/catalog.json, data/glossary.json, data/version.json, data/laws/*.json
 * خروجی:  public/data/manifest.json
 *         public/data/catalog.<hash>.json      فراداده همه قوانین (شامل موارد «در انتظار ورود»)
 *         public/data/glossary.<hash>.json     واژه‌نامه جستجوی مفهومی
 *         public/data/chunks/<n>.<hash>.json   مواد قانونی در بسته‌های حداکثر ~۵۰۰KB
 *         public/data/patches/*.json           به‌روزرسانی‌های افزایشی (JSON Patch / RFC 6902)
 *         public/data/qindex/*                 «فهرست مصوبات» سامانه ملی قوانین (۱۵۰ هزار عنوان؛ دریافت در صورت نیاز)
 *
 * اجرا:
 *   npm run data                 بسته‌بندی نسخه فعلی (در dev و build به‌طور خودکار اجرا می‌شود)
 *   npm run data -- --release    مقایسه با آخرین انتشار، افزایش خودکار نسخه (semver) و ساخت patch
 *   npm run data -- --release --level=minor   تعیین دستی سطح نسخه (major | minor | patch)
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildQIndex } from './lib/qindex-build.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'data')
const OUT = join(ROOT, 'public', 'data')
const CHUNK_LIMIT = 490 * 1024
const SCHEMA_VERSION = 1

type Json = Record<string, any>

const readJson = (p: string): Json => JSON.parse(readFileSync(p, 'utf8'))
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const short = (s: string) => sha(s).slice(0, 10)

/** فشرده‌سازی کلیدهای ماده برای کاهش حجم (در کلاینت به Article کامل تبدیل می‌شود) */
function compactArticle(lawId: string, a: Json): Json {
  const c: Json = { i: `${lawId}:${a.key}`, k: a.key, n: a.number, l: a.label, t: a.text, st: a.status }
  if (a.suffix) c.s = a.suffix
  if (a.heading) c.h = a.heading
  if (a.notes?.length) c.no = a.notes
  if (a.amendments?.length) c.am = a.amendments.map((m: Json) => ({ k: m.kind, d: m.date ?? undefined, r: m.raw }))
  if (a.refs?.length) c.r = a.refs
  if (a.keywords?.length) c.kw = a.keywords
  return c
}

function lawMeta(law: Json, available: boolean): Json {
  const { articles: _a, toc: _t, preamble: _p, schemaVersion: _s, ...meta } = law
  return { ...meta, available }
}

function catalogOnlyLaw(entry: Json): Json {
  return {
    id: entry.id,
    title: entry.title,
    shortTitle: entry.shortTitle ?? entry.title,
    aliases: entry.aliases ?? [],
    hierarchy: entry.hierarchy,
    category: entry.category,
    docType: entry.docType,
    unit: entry.unit ?? 'ماده',
    status: entry.status ?? 'لازم‌الاجرا',
    priority: entry.priority ?? 0,
    featured: !!entry.featured,
    approval: entry.approval ?? {},
    approvalNote: entry.approvalNote ?? null,
    description: entry.description ?? null,
    crossLinks: entry.crossLinks ?? [],
    related: entry.related ?? [],
    kind: entry.kind ?? 'law',
    expectedArticles: entry.expectedArticles ?? null,
    ...(entry.members ? { members: entry.members } : {}),
    ...(entry.qindex ? { qindex: entry.qindex } : {}),
    ...(entry.seeAlso ? { seeAlso: entry.seeAlso } : {}),
    source: {
      kind: entry.source?.kind ?? 'pending',
      verification: entry.kind === 'info' ? 'info' : 'pending',
      ...(entry.source?.qavaninId
        ? { qavaninId: entry.source.qavaninId, officialUrl: `https://qavanin.ir/Law/TreeText/${entry.source.qavaninId}` }
        : {}),
    },
    lastUpdated: null,
    stats: { articles: 0 },
    available: false,
  }
}

function articleHash(a: Json) {
  return short(JSON.stringify(a))
}

function bump(version: string, level: 'major' | 'minor' | 'patch') {
  const [M, m, p] = version.split('.').map(Number)
  if (level === 'major') return `${M + 1}.0.0`
  if (level === 'minor') return `${M}.${m + 1}.0`
  return `${M}.${m}.${p + 1}`
}

function cmpSemver(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

function main() {
  const release = process.argv.includes('--release')
  const catalog = readJson(join(DATA, 'catalog.json'))
  const glossary = readJson(join(DATA, 'glossary.json'))
  const versionFile = join(DATA, 'version.json')
  const versionInfo = existsSync(versionFile) ? readJson(versionFile) : { version: '1.0.0' }

  // --- قوانین موجود
  const lawFiles = new Map<string, Json>()
  for (const f of readdirSync(join(DATA, 'laws'))) {
    if (!f.endsWith('.json') || f === 'index.json') continue
    const law = readJson(join(DATA, 'laws', f))
    lawFiles.set(law.id, law)
  }

  const laws: Json[] = []
  const compactByLaw = new Map<string, Json[]>()
  for (const entry of catalog.laws as Json[]) {
    const law = lawFiles.get(entry.id)
    if (law) {
      laws.push({ ...lawMeta(law, true), related: entry.related ?? [], kind: entry.kind ?? 'law' })
      compactByLaw.set(law.id, law.articles.map((a: Json) => compactArticle(law.id, a)))
    } else {
      laws.push(catalogOnlyLaw(entry))
    }
  }
  laws.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  // --- اثرانگشت محتوا برای نسخه‌بندی
  const articleHashes: Record<string, string> = {}
  const lawHashes: Record<string, string> = {}
  for (const law of laws) {
    if (!law.available) continue
    const full = lawFiles.get(law.id)!
    lawHashes[law.id] = short(JSON.stringify({ ...lawMeta(full, true), toc: full.toc, preamble: full.preamble }))
    for (const c of compactByLaw.get(law.id)!) articleHashes[c.i] = articleHash(c)
  }
  // --- فهرست مصوبات سامانه ملی قوانین (مستقل از نسخه داده‌ها؛ خلاصه آن در کاتالوگ می‌آید)
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'chunks'), { recursive: true })
  mkdirSync(join(OUT, 'patches'), { recursive: true })
  const inApp: Record<string, string> = {}
  for (const law of laws) if (law.available && law.source?.qavaninId) inApp[String(law.source.qavaninId)] = law.id
  const qindex = buildQIndex(ROOT, OUT, inApp)

  const catalogOut = {
    schemaVersion: SCHEMA_VERSION,
    hierarchy: catalog.hierarchy,
    categories: catalog.categories,
    laws,
    ...(qindex ? { qindex: qindex.summary } : {}),
  }
  const catalogStr = JSON.stringify(catalogOut)
  const catalogHash = short(catalogStr)
  // اثرانگشت شامل کاتالوگ است تا تغییر فراداده‌ها (دسته‌ها، موارد جدید، پیوندهای رسمی) هم به کاربران برسد
  const fingerprint = short(JSON.stringify({ lawHashes, articleHashes, catalog: catalogHash }))

  const releasesDir = join(DATA, 'releases')
  const patchesDir = join(DATA, 'patches')
  mkdirSync(releasesDir, { recursive: true })
  mkdirSync(patchesDir, { recursive: true })
  const releaseFiles = readdirSync(releasesDir)
    .filter((f) => /^\d+\.\d+\.\d+\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ''))
    .sort(cmpSemver)
  const latest = releaseFiles.at(-1)

  let version: string = versionInfo.version
  const levelArg = process.argv.find((a) => a.startsWith('--level='))?.slice('--level='.length) as 'major' | 'minor' | 'patch' | undefined
  const catalogIds = laws.map((l) => l.id)
  if (release) {
    if (!latest) {
      // نخستین انتشار
      writeFileSync(join(releasesDir, `${version}.json`), JSON.stringify({ version, fingerprint, catalogHash, catalogIds, lawHashes, articleHashes }) + '\n')
      console.log(`● نخستین انتشار ${version} ثبت شد.`)
    } else {
      const prev = readJson(join(releasesDir, `${latest}.json`))
      if (prev.fingerprint === fingerprint) {
        console.log(`● تغییری نسبت به ${latest} وجود ندارد.`)
        version = latest
      } else {
        const ops: Json[] = []
        const added = Object.keys(articleHashes).filter((id) => !(id in prev.articleHashes))
        const removed = Object.keys(prev.articleHashes).filter((id) => !(id in articleHashes))
        const changed = Object.keys(articleHashes).filter((id) => id in prev.articleHashes && prev.articleHashes[id] !== articleHashes[id])
        const lawsAdded = Object.keys(lawHashes).filter((id) => !(id in prev.lawHashes))
        const lawsRemoved = Object.keys(prev.lawHashes).filter((id) => !(id in lawHashes))
        const lawsChanged = Object.keys(lawHashes).filter((id) => id in prev.lawHashes && prev.lawHashes[id] !== lawHashes[id])
        const catalogAdded = prev.catalogIds ? catalogIds.filter((id) => !prev.catalogIds.includes(id)) : []
        const auto: 'major' | 'minor' | 'patch' = lawsRemoved.length ? 'major' : added.length || lawsAdded.length || catalogAdded.length ? 'minor' : 'patch'
        const level = levelArg ?? auto
        version = bump(latest, level)
        const compactIndex = new Map<string, Json>()
        for (const list of compactByLaw.values()) for (const c of list) compactIndex.set(c.i, c)
        for (const id of [...lawsAdded, ...lawsChanged]) {
          const full = lawFiles.get(id)!
          ops.push({ op: lawsAdded.includes(id) ? 'add' : 'replace', path: `/laws/${id}`, value: { ...lawMeta(full, true), toc: full.toc, preamble: full.preamble } })
        }
        for (const id of lawsRemoved) ops.push({ op: 'remove', path: `/laws/${id}` })
        for (const id of added) ops.push({ op: 'add', path: `/articles/${id}`, value: compactIndex.get(id) })
        for (const id of changed) ops.push({ op: 'replace', path: `/articles/${id}`, value: compactIndex.get(id) })
        for (const id of removed) ops.push({ op: 'remove', path: `/articles/${id}` })
        const patch = { from: latest, to: version, generatedAt: new Date().toISOString(), level, ops }
        writeFileSync(join(patchesDir, `${latest}_${version}.json`), JSON.stringify(patch) + '\n')
        writeFileSync(join(releasesDir, `${version}.json`), JSON.stringify({ version, fingerprint, catalogHash, catalogIds, lawHashes, articleHashes }) + '\n')
        writeFileSync(versionFile, JSON.stringify({ ...versionInfo, version, releasedAt: new Date().toISOString().slice(0, 10) }, null, 2) + '\n')
        console.log(
          `● انتشار ${version} (${level}): +${added.length} ماده، ~${changed.length} تغییر، -${removed.length} حذف؛ قوانین +${lawsAdded.length} ~${lawsChanged.length} -${lawsRemoved.length}`,
        )
      }
    }
  } else if (latest) {
    const prev = readJson(join(releasesDir, `${latest}.json`))
    if (prev.fingerprint !== fingerprint) {
      console.warn(`⚠ محتوای داده با آخرین انتشار (${latest}) متفاوت است. برای ثبت نسخه جدید: npm run data -- --release`)
    }
  }

  // --- خروجی
  const catalogFile = `catalog.${catalogHash}.json`
  writeFileSync(join(OUT, catalogFile), catalogStr)

  const glossaryStr = JSON.stringify(glossary.concepts)
  const glossaryFile = `glossary.${short(glossaryStr)}.json`
  writeFileSync(join(OUT, glossaryFile), glossaryStr)

  // بسته‌بندی: قوانین به ترتیب اولویت، هر بسته حداکثر CHUNK_LIMIT بایت
  const chunks: Json[] = []
  let cur: { laws: Json[]; articles: Json[]; bytes: number } = { laws: [], articles: [], bytes: 0 }
  const flush = () => {
    if (!cur.laws.length && !cur.articles.length) return
    const body = JSON.stringify({ laws: cur.laws, articles: cur.articles })
    const hash = short(body)
    const file = `chunks/${String(chunks.length).padStart(3, '0')}.${hash}.json`
    writeFileSync(join(OUT, file), body)
    chunks.push({
      file,
      hash,
      bytes: Buffer.byteLength(body),
      articles: cur.articles.length,
      laws: [...new Set(cur.articles.map((a) => a.i.split(':')[0]))],
    })
    cur = { laws: [], articles: [], bytes: 0 }
  }
  for (const law of laws) {
    if (!law.available) continue
    const full = lawFiles.get(law.id)!
    const lawRecord = { ...lawMeta(full, true), related: law.related, kind: law.kind, toc: full.toc, preamble: full.preamble }
    const lawBytes = Buffer.byteLength(JSON.stringify(lawRecord))
    if (cur.bytes + lawBytes > CHUNK_LIMIT && cur.bytes > 0) flush()
    cur.laws.push(lawRecord)
    cur.bytes += lawBytes
    for (const c of compactByLaw.get(law.id)!) {
      const b = Buffer.byteLength(JSON.stringify(c)) + 1
      if (cur.bytes + b > CHUNK_LIMIT && cur.bytes > 0) flush()
      cur.articles.push(c)
      cur.bytes += b
    }
  }
  flush()

  // patchها
  const patches: Json[] = []
  for (const f of readdirSync(patchesDir).filter((f) => f.endsWith('.json'))) {
    const p = readJson(join(patchesDir, f))
    copyFileSync(join(patchesDir, f), join(OUT, 'patches', f))
    patches.push({ from: p.from, to: p.to, level: p.level, file: `patches/${f}`, bytes: readFileSync(join(patchesDir, f)).length, ops: p.ops.length })
  }

  const totals = {
    laws: laws.filter((l) => l.available).length,
    catalog: laws.length,
    articles: Object.keys(articleHashes).length,
    bytes: chunks.reduce((s, c) => s + c.bytes, 0),
  }
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    name: 'کتابچه قانون ایران',
    version,
    fingerprint,
    generatedAt: new Date().toISOString(),
    catalog: catalogFile,
    glossary: glossaryFile,
    totals,
    chunks,
    patches: patches.sort((a, b) => cmpSemver(a.to, b.to)),
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1))
  console.log(
    `✓ داده نسخه ${version}: ${totals.laws}/${totals.catalog} قانون، ${totals.articles} ماده در ${chunks.length} بسته (${(totals.bytes / 1024).toFixed(0)}KB) → public/data/`,
  )
  if (qindex) {
    const q = qindex.manifest
    console.log(
      `✓ فهرست مصوبات: ${q.count.toLocaleString('en')} عنوان (تا ${q.latestDate}) در ${q.types.reduce((s, t) => s + t.chunks.length, 0)} بسته (${(q.bytes / 1024 / 1024).toFixed(1)}MB) → public/data/qindex/`,
    )
  }
}

main()
