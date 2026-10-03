/**
 * همگام‌سازی داده‌های قوانین با IndexedDB
 * این ماژول به DOM وابسته نیست و هم در اپ و هم در Service Worker (Background Sync) اجرا می‌شود.
 *
 * - نصب اولیه: دانلود بسته‌های ~۵۰۰KB به ترتیب اولویت (قابل ادامه پس از قطع اتصال)
 * - به‌روزرسانی: زنجیره patchهای JSON Patch (RFC 6902) از نسخه فعلی تا آخرین نسخه؛
 *   در نبود زنجیره کامل، دانلود مجدد فقط قوانینی که بسته‌هایشان تغییر کرده است.
 */
import { db, getMeta, setMeta } from '../db'
import type {
  Article,
  CatalogFile,
  CompactArticle,
  DataManifest,
  DatasetMeta,
  GlossaryConcept,
  Law,
  TocNode,
} from '../types'

export const DATA_BASE = '/data/'
export const META_KEY = 'dataset'
export const GLOSSARY_KEY = 'glossary'
export const CATALOG_KEY = 'catalog'
export const CATALOG_LAWS_KEY = 'catalogLaws'

export interface ImportProgress {
  phase: 'manifest' | 'catalog' | 'chunks' | 'patch' | 'index' | 'done' | 'error'
  loaded: number
  total: number
  bytes: number
  totalBytes: number
  message?: string
}

type ProgressFn = (p: ImportProgress) => void

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(DATA_BASE + path, init)
  if (!res.ok) throw new Error(`HTTP ${res.status} برای ${path}`)
  return (await res.json()) as T
}

export async function fetchManifest(): Promise<DataManifest> {
  return getJson<DataManifest>('manifest.json', { cache: 'no-cache' })
}

export async function getDatasetMeta(): Promise<DatasetMeta | undefined> {
  return getMeta<DatasetMeta>(META_KEY)
}

/** تبدیل ماده فشرده به رکورد کامل */
export function expandArticle(c: CompactArticle, law: Law, order: number, toc: Map<string, TocNode>): Article {
  const heading = c.h ? toc.get(c.h) : undefined
  let top = heading
  while (top && top.parent) {
    const p = toc.get(top.parent)
    if (!p) break
    top = p
  }
  const articleNumber: number | string = c.s ? (c.s === 'واحده' ? 'واحده' : `${c.n} ${c.s}`) : c.n
  return {
    id: c.i,
    lawId: law.id,
    lawTitle: law.shortTitle || law.title,
    category: law.category,
    hierarchy: law.hierarchy,
    docType: law.docType,
    chapter: heading?.title,
    section: top && top !== heading ? top.title : undefined,
    headingId: c.h,
    articleNumber,
    key: c.k,
    order,
    label: c.l,
    text: c.t,
    notes: c.no,
    amendments: c.am?.map((m) => ({ kind: m.k, date: m.d, raw: m.r })),
    status: c.st,
    relatedArticles: c.r?.map((k) => `${law.id}:${k}`),
    keywords: c.kw ?? [],
    sourceUrl: law.source?.url ?? undefined,
    approvalYear: law.approval?.year,
  }
}

function tocMap(law: Law): Map<string, TocNode> {
  return new Map((law.toc ?? []).map((t) => [t.id, t]))
}

/** فهرست (کاتالوگ) و واژه‌نامه را ذخیره می‌کند؛ toc/preamble قوانین موجود حفظ می‌شود. */
export async function importCatalog(manifest: DataManifest): Promise<CatalogFile> {
  const [catalog, glossary] = await Promise.all([
    getJson<CatalogFile>(manifest.catalog),
    getJson<GlossaryConcept[]>(manifest.glossary),
  ])
  await db.transaction('rw', db.laws, db.meta, async () => {
    const existing = new Map((await db.laws.toArray()).map((l) => [l.id, l]))
    const records = catalog.laws.map((l) => {
      const prev = existing.get(l.id)
      return prev ? { ...l, toc: prev.toc ?? l.toc, preamble: prev.preamble ?? l.preamble } : l
    })
    await db.laws.bulkPut(records)
    // قوانینی که از کاتالوگ حذف شده‌اند
    const ids = new Set(catalog.laws.map((l) => l.id))
    const stale = [...existing.keys()].filter((id) => !ids.has(id))
    if (stale.length) await db.laws.bulkDelete(stale)
    await db.meta.bulkPut([
      { key: GLOSSARY_KEY, value: glossary },
      { key: CATALOG_KEY, value: { hierarchy: catalog.hierarchy, categories: catalog.categories, file: manifest.catalog } },
      // فهرست سبک قوانین (بدون فهرست مطالب) برای صفحات فهرستی؛ نوشتن مواد باعث رندر مجدد آن‌ها نمی‌شود
      { key: CATALOG_LAWS_KEY, value: [...catalog.laws].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)) },
    ])
  })
  return catalog
}

interface ChunkFile {
  laws: Law[]
  articles: CompactArticle[]
}

async function writeChunk(chunk: ChunkFile, lawCache: Map<string, Law>, orderCounters: Map<string, number>) {
  for (const law of chunk.laws) lawCache.set(law.id, law)
  const articles: Article[] = []
  for (const c of chunk.articles) {
    const lawId = c.i.slice(0, c.i.indexOf(':'))
    let law = lawCache.get(lawId)
    if (!law) {
      law = (await db.laws.get(lawId)) as Law | undefined
      if (!law) throw new Error(`قانون ${lawId} برای ماده ${c.i} یافت نشد`)
      lawCache.set(lawId, law)
    }
    const order = orderCounters.get(lawId) ?? 0
    orderCounters.set(lawId, order + 1)
    articles.push(expandArticle(c, law, order, tocMap(law)))
  }
  const amendments = articles.flatMap((a) =>
    (a.amendments ?? []).filter((m) => m.date).map((m) => ({ articleId: a.id, date: m.date!, kind: m.kind, raw: m.raw })),
  )
  await db.transaction('rw', db.laws, db.articles, db.amendments, async () => {
    if (chunk.laws.length) await db.laws.bulkPut(chunk.laws)
    await db.articles.bulkPut(articles)
    if (amendments.length) await db.amendments.bulkAdd(amendments)
  })
}

async function removeLawArticles(lawIds: string[]) {
  await db.transaction('rw', db.articles, db.amendments, async () => {
    for (const id of lawIds) {
      await db.articles.where('lawId').equals(id).delete()
      await db.amendments.where('articleId').startsWith(`${id}:`).delete()
    }
  })
}

async function invalidateSearchIndex() {
  await db.searchIndex.clear()
}

/**
 * نصب یا تکمیل داده‌ها. اگر نصب قبلی ناتمام مانده باشد از همان‌جا ادامه می‌دهد.
 */
export async function installDataset(onProgress?: ProgressFn): Promise<DatasetMeta> {
  const progress = (p: Partial<ImportProgress> & { phase: ImportProgress['phase'] }) =>
    onProgress?.({ loaded: 0, total: 0, bytes: 0, totalBytes: 0, ...p })
  progress({ phase: 'manifest' })
  const manifest = await fetchManifest()
  let meta = await getDatasetMeta()

  if (meta?.complete && meta.fingerprint === manifest.fingerprint) {
    progress({ phase: 'done', loaded: manifest.chunks.length, total: manifest.chunks.length })
    return meta
  }
  if (meta?.complete && meta.fingerprint !== manifest.fingerprint) {
    // نصب کامل قبلی وجود دارد → به‌روزرسانی
    await updateDataset(onProgress, manifest)
    return (await getDatasetMeta())!
  }

  progress({ phase: 'catalog' })
  await importCatalog(manifest)

  // ادامه نصب ناتمام فقط اگر همان نسخه باشد
  const done = new Set(meta && meta.fingerprint === manifest.fingerprint ? meta.chunks : [])
  if (!meta || meta.fingerprint !== manifest.fingerprint) {
    await db.transaction('rw', db.articles, db.amendments, async () => {
      await db.articles.clear()
      await db.amendments.clear()
    })
  }
  meta = {
    version: manifest.version,
    fingerprint: manifest.fingerprint,
    chunks: [...done],
    catalogFile: manifest.catalog,
    glossaryFile: manifest.glossary,
    installedAt: meta?.installedAt ?? Date.now(),
    updatedAt: Date.now(),
    articleCount: 0,
    complete: false,
  }
  await setMeta(META_KEY, meta)

  const total = manifest.chunks.length
  const totalBytes = manifest.chunks.reduce((s, c) => s + c.bytes, 0)
  let bytes = manifest.chunks.filter((c) => done.has(c.hash)).reduce((s, c) => s + c.bytes, 0)
  const lawCache = new Map<string, Law>()
  const orderCounters = new Map<string, number>()
  // شمارنده ترتیب مواد باید از ابتدای هر قانون محاسبه شود؛ برای ادامه نصب، شمارش موجود را بازسازی می‌کنیم
  if (done.size) {
    const counts = new Map<string, number>()
    await db.articles.each((a) => counts.set(a.lawId, Math.max(counts.get(a.lawId) ?? 0, a.order + 1)))
    for (const [k, v] of counts) orderCounters.set(k, v)
  }

  for (let i = 0; i < manifest.chunks.length; i++) {
    const c = manifest.chunks[i]
    if (done.has(c.hash)) continue
    progress({ phase: 'chunks', loaded: done.size, total, bytes, totalBytes })
    const chunk = await getJson<ChunkFile>(c.file)
    await writeChunk(chunk, lawCache, orderCounters)
    done.add(c.hash)
    bytes += c.bytes
    meta = { ...meta, chunks: [...done], updatedAt: Date.now() }
    await setMeta(META_KEY, meta)
    progress({ phase: 'chunks', loaded: done.size, total, bytes, totalBytes })
  }

  const articleCount = await db.articles.count()
  meta = { ...meta, complete: true, articleCount, updatedAt: Date.now() }
  await setMeta(META_KEY, meta)
  await invalidateSearchIndex()
  progress({ phase: 'done', loaded: total, total, bytes: totalBytes, totalBytes })
  return meta
}

export interface UpdateCheck {
  available: boolean
  current?: string
  latest: string
  manifest: DataManifest
  patchChain?: DataManifest['patches']
}

export function findPatchChain(manifest: DataManifest, from: string): DataManifest['patches'] | undefined {
  const chain: DataManifest['patches'] = []
  let cur = from
  const seen = new Set<string>()
  while (cur !== manifest.version) {
    if (seen.has(cur)) return undefined
    seen.add(cur)
    const next = manifest.patches.find((p) => p.from === cur)
    if (!next) return undefined
    chain.push(next)
    cur = next.to
  }
  return chain
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  const manifest = await fetchManifest()
  const meta = await getDatasetMeta()
  const available = !meta || !meta.complete || meta.fingerprint !== manifest.fingerprint
  return {
    available,
    current: meta?.version,
    latest: manifest.version,
    manifest,
    patchChain: meta ? findPatchChain(manifest, meta.version) : undefined,
  }
}

interface PatchFile {
  from: string
  to: string
  ops: { op: 'add' | 'replace' | 'remove'; path: string; value?: any }[]
}

function decodePointer(seg: string) {
  return seg.replace(/~1/g, '/').replace(/~0/g, '~')
}

/** اعمال یک فایل JSON Patch روی IndexedDB؛ شناسه مواد تغییر‌یافته را برمی‌گرداند. */
export async function applyPatch(patch: PatchFile): Promise<string[]> {
  const changed: string[] = []
  await db.transaction('rw', db.laws, db.articles, db.amendments, async () => {
    // ابتدا قوانین (تا toc برای مواد در دسترس باشد)
    for (const op of patch.ops) {
      const [, table, rawId] = op.path.split('/')
      if (table !== 'laws') continue
      const id = decodePointer(rawId)
      if (op.op === 'remove') {
        await db.laws.delete(id)
        await db.articles.where('lawId').equals(id).delete()
        await db.amendments.where('articleId').startsWith(`${id}:`).delete()
      } else {
        const prev = await db.laws.get(id)
        await db.laws.put({ ...(prev ?? {}), ...op.value })
      }
    }
    const lawCache = new Map<string, Law>()
    for (const op of patch.ops) {
      const [, table, rawId] = op.path.split('/')
      if (table !== 'articles') continue
      const id = decodePointer(rawId)
      changed.push(id)
      await db.amendments.where('articleId').equals(id).delete()
      if (op.op === 'remove') {
        await db.articles.delete(id)
        continue
      }
      const c = op.value as CompactArticle
      const lawId = id.slice(0, id.indexOf(':'))
      let law = lawCache.get(lawId)
      if (!law) {
        law = (await db.laws.get(lawId)) as Law
        lawCache.set(lawId, law)
      }
      const prev = await db.articles.get(id)
      let order = prev?.order
      if (order === undefined) {
        // ماده جدید: بعد از ماده با شماره کوچک‌تر قرار می‌گیرد
        const siblings = await db.articles.where('lawId').equals(lawId).toArray()
        const before = siblings.filter((s) => (typeof s.articleNumber === 'number' ? s.articleNumber : parseInt(String(s.articleNumber))) <= c.n)
        order = before.length ? Math.max(...before.map((s) => s.order)) + 0.5 : -1
      }
      const art = expandArticle(c, law, order, tocMap(law))
      await db.articles.put(art)
      const ams = (art.amendments ?? []).filter((m) => m.date)
      if (ams.length) await db.amendments.bulkAdd(ams.map((m) => ({ articleId: id, date: m.date!, kind: m.kind, raw: m.raw })))
    }
  })
  return changed
}

export interface UpdateResult {
  updated: boolean
  from?: string
  to: string
  changedArticleIds: string[]
  method: 'none' | 'patch' | 'chunks' | 'install'
}

/** به‌روزرسانی افزایشی داده‌ها */
export async function updateDataset(onProgress?: ProgressFn, manifestArg?: DataManifest): Promise<UpdateResult> {
  const manifest = manifestArg ?? (await fetchManifest())
  const meta = await getDatasetMeta()
  if (!meta || !meta.complete) {
    await installDataset(onProgress)
    return { updated: true, to: manifest.version, changedArticleIds: [], method: 'install' }
  }
  if (meta.fingerprint === manifest.fingerprint) {
    return { updated: false, from: meta.version, to: manifest.version, changedArticleIds: [], method: 'none' }
  }

  const changedArticleIds: string[] = []
  let method: UpdateResult['method'] = 'chunks'
  const chain = findPatchChain(manifest, meta.version)
  if (chain && chain.length) {
    method = 'patch'
    let i = 0
    for (const p of chain) {
      onProgress?.({ phase: 'patch', loaded: i, total: chain.length, bytes: 0, totalBytes: 0, message: `${p.from} → ${p.to}` })
      const patch = await getJson<PatchFile>(p.file)
      changedArticleIds.push(...(await applyPatch(patch)))
      i++
    }
    await importCatalog(manifest)
  } else {
    // دانلود مجدد قوانینی که بسته‌هایشان تغییر کرده است
    const have = new Set(meta.chunks)
    const changedChunks = manifest.chunks.filter((c) => !have.has(c.hash))
    const affectedLaws = new Set(changedChunks.flatMap((c) => c.laws))
    const needed = manifest.chunks.filter((c) => c.laws.some((l) => affectedLaws.has(l)))
    await importCatalog(manifest)
    const before = new Map<string, string>()
    for (const lawId of affectedLaws) {
      await db.articles
        .where('lawId')
        .equals(lawId)
        .each((a) => before.set(a.id, a.text + '|' + (a.notes ?? []).join('|')))
    }
    await removeLawArticles([...affectedLaws])
    const lawCache = new Map<string, Law>()
    const orderCounters = new Map<string, number>()
    let i = 0
    for (const c of needed) {
      onProgress?.({ phase: 'chunks', loaded: i, total: needed.length, bytes: 0, totalBytes: 0 })
      const chunk = await getJson<ChunkFile>(c.file)
      // فقط مواد قوانین متأثر را بنویس
      const filtered: ChunkFile = {
        laws: chunk.laws.filter((l) => affectedLaws.has(l.id)),
        articles: chunk.articles.filter((a) => affectedLaws.has(a.i.slice(0, a.i.indexOf(':')))),
      }
      await writeChunk(filtered, lawCache, orderCounters)
      i++
    }
    for (const lawId of affectedLaws) {
      await db.articles
        .where('lawId')
        .equals(lawId)
        .each((a) => {
          const sig = a.text + '|' + (a.notes ?? []).join('|')
          if (before.get(a.id) !== sig) changedArticleIds.push(a.id)
          before.delete(a.id)
        })
    }
    changedArticleIds.push(...before.keys())
  }

  await setMeta<DatasetMeta>(META_KEY, {
    ...meta,
    version: manifest.version,
    fingerprint: manifest.fingerprint,
    chunks: manifest.chunks.map((c) => c.hash),
    catalogFile: manifest.catalog,
    glossaryFile: manifest.glossary,
    updatedAt: Date.now(),
    articleCount: await db.articles.count(),
    complete: true,
  })
  await invalidateSearchIndex()
  onProgress?.({ phase: 'done', loaded: 1, total: 1, bytes: 0, totalBytes: 0 })
  return { updated: true, from: meta.version, to: manifest.version, changedArticleIds, method }
}

/** مواد نشان‌شده‌ای که در به‌روزرسانی تغییر کرده‌اند */
export async function bookmarkedAmong(ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const set = new Set(ids)
  const bms = await db.bookmarks.toArray()
  return bms.map((b) => b.articleId).filter((id) => set.has(id))
}
