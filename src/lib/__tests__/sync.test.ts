import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { applyPatch, bookmarkedAmong, CATALOG_KEY, CATALOG_SCHEMA, checkForUpdate, findPatchChain, installDataset, updateDataset } from '../data/sync'
import { getMeta, setMeta } from '../db'
import type { DataManifest } from '../types'

const law = {
  id: 'civil-code',
  title: 'قانون مدنی',
  shortTitle: 'قانون مدنی',
  aliases: [],
  hierarchy: 'statute',
  category: 'civil',
  docType: 'قانون',
  unit: 'ماده',
  status: 'لازم‌الاجرا',
  priority: 95,
  featured: true,
  approval: { date: '1307/02/18', year: 1307 },
  crossLinks: [],
  source: { kind: 'qavanin-text', verification: 'source-copy' },
  lastUpdated: '1403/02/15',
  stats: { articles: 2 },
  available: true,
}
const toc = [{ id: 'h1', title: 'مقدمه', parent: null, depth: 0, first: '1', count: 2 }]
const art = (k: string, t: string) => ({ i: `civil-code:${k}`, k, n: Number(k), l: `ماده ${k}`, h: 'h1', t, st: 'لازم‌الاجرا' })

let files: Record<string, unknown> = {}
function serve(manifest: DataManifest, extra: Record<string, unknown> = {}) {
  files = { 'manifest.json': manifest, ...extra }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.stubGlobal('fetch', async (url: string) => {
    const key = String(url).replace('/data/', '')
    if (!(key in files)) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(files[key]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
})

const manifestV1: DataManifest = {
  schemaVersion: 1,
  name: 't',
  version: '1.0.0',
  fingerprint: 'fp1',
  generatedAt: '',
  catalog: 'catalog.json',
  glossary: 'glossary.json',
  totals: { laws: 1, catalog: 1, articles: 2, bytes: 1 },
  chunks: [{ file: 'chunks/000.json', hash: 'c1', bytes: 100, articles: 2, laws: ['civil-code'] }],
  patches: [],
}

describe('نصب و به‌روزرسانی داده‌ها', () => {
  it('نصب اولیه بسته‌ها را در IndexedDB می‌نویسد', async () => {
    serve(manifestV1, {
      'catalog.json': { schemaVersion: 1, hierarchy: [], categories: [], laws: [law] },
      'glossary.json': [],
      'chunks/000.json': { laws: [{ ...law, toc, preamble: '' }], articles: [art('1', 'متن یک'), art('2', 'متن دو')] },
    })
    const meta = await installDataset()
    expect(meta.complete).toBe(true)
    expect(await db.articles.count()).toBe(2)
    const a = await db.articles.get('civil-code:2')
    expect(a?.lawTitle).toBe('قانون مدنی')
    expect(a?.chapter).toBe('مقدمه')
    expect(a?.order).toBe(1)
  })

  it('به‌روزرسانی با JSON Patch فقط تغییرات را اعمال می‌کند', async () => {
    serve(manifestV1, {
      'catalog.json': { schemaVersion: 1, hierarchy: [], categories: [], laws: [law] },
      'glossary.json': [],
      'chunks/000.json': { laws: [{ ...law, toc, preamble: '' }], articles: [art('1', 'متن یک'), art('2', 'متن دو')] },
    })
    await installDataset()
    await db.bookmarks.add({ articleId: 'civil-code:2', createdAt: 1 })

    const manifestV2: DataManifest = {
      ...manifestV1,
      version: '1.1.0',
      fingerprint: 'fp2',
      chunks: [{ file: 'chunks/000b.json', hash: 'c2', bytes: 100, articles: 2, laws: ['civil-code'] }],
      patches: [{ from: '1.0.0', to: '1.1.0', level: 'minor', file: 'patches/1.0.0_1.1.0.json', bytes: 10, ops: 3 }],
    }
    serve(manifestV2, {
      'catalog.json': { schemaVersion: 1, hierarchy: [], categories: [], laws: [law] },
      'glossary.json': [],
      'patches/1.0.0_1.1.0.json': {
        from: '1.0.0',
        to: '1.1.0',
        ops: [
          { op: 'replace', path: '/articles/civil-code:2', value: art('2', 'متن اصلاح‌شده دو') },
          { op: 'add', path: '/articles/civil-code:3', value: art('3', 'ماده جدید') },
          { op: 'remove', path: '/articles/civil-code:1' },
        ],
      },
    })
    expect(findPatchChain(manifestV2, '1.0.0')?.length).toBe(1)
    const res = await updateDataset()
    expect(res.method).toBe('patch')
    expect(res.changedArticleIds.sort()).toEqual(['civil-code:1', 'civil-code:2', 'civil-code:3'])
    expect((await db.articles.get('civil-code:2'))?.text).toBe('متن اصلاح‌شده دو')
    expect(await db.articles.get('civil-code:1')).toBeUndefined()
    expect((await db.articles.get('civil-code:3'))?.text).toBe('ماده جدید')
    expect(await bookmarkedAmong(res.changedArticleIds)).toEqual(['civil-code:2'])
  })

  it('کاتالوگ ذخیره‌شده با قالب قدیمی (اپ نسخه قبل) یک بار دوباره وارد می‌شود', async () => {
    const qindex = { count: 3, latestDate: '1401/01/30', earliestYear: 1285, byType: { statute: 3 }, bytes: 1, transferBytes: 1, version: 'v' }
    serve(manifestV1, {
      'catalog.json': { schemaVersion: 1, hierarchy: [], categories: [], laws: [law], qindex },
      'glossary.json': [],
      'chunks/000.json': { laws: [{ ...law, toc, preamble: '' }], articles: [art('1', 'متن یک'), art('2', 'متن دو')] },
    })
    await installDataset()
    expect((await getMeta<{ schema: number }>(CATALOG_KEY))?.schema).toBe(CATALOG_SCHEMA)
    // شبیه‌سازی رکوردی که نسخه قبلی اپ (بدون schema و qindex) نوشته است
    await setMeta(CATALOG_KEY, { hierarchy: [], categories: [], file: 'catalog.json' })
    expect((await checkForUpdate()).available).toBe(true)
    const res = await updateDataset()
    expect(res.updated).toBe(false)
    const cat = await getMeta<{ schema: number; qindex: typeof qindex }>(CATALOG_KEY)
    expect(cat?.schema).toBe(CATALOG_SCHEMA)
    expect(cat?.qindex.count).toBe(3)
    expect((await checkForUpdate()).available).toBe(false)
  })

  it('applyPatch حذف قانون، مواد آن را هم حذف می‌کند', async () => {
    await db.laws.put({ ...(law as never), toc })
    await db.articles.put({ id: 'civil-code:1', lawId: 'civil-code', key: '1', order: 0, label: 'ماده 1', text: 'x', status: 'لازم‌الاجرا', keywords: [] } as never)
    await applyPatch({ from: 'a', to: 'b', ops: [{ op: 'remove', path: '/laws/civil-code' }] })
    expect(await db.laws.count()).toBe(0)
    expect(await db.articles.count()).toBe(0)
  })
})
