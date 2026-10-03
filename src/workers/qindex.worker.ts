/**
 * Web Worker «فهرست مصوبات» — جستجو در ۱۵۰ هزار عنوان سامانه ملی قوانین
 *
 * بسته‌های ستونی /data/qindex/* را (از شبکه یا در حالت آفلاین از Cache Storage) بارگذاری می‌کند و
 * پرس‌وجوها را با QIndexEngine خارج از رشته اصلی رابط کاربری پاسخ می‌دهد.
 */
import { QIndexEngine } from '../lib/qindex/engine'
import type { QIndexChunk, QIndexManifest } from '../lib/qindex/model'
import type { QSearchParams } from '../lib/qindex/client'

type InMsg = { id: number; type: 'load' } | { id: number; type: 'search'; params: QSearchParams } | { id: number; type: 'get'; qid: number }

interface WorkerScope {
  postMessage(msg: unknown): void
  addEventListener(type: 'message', fn: (e: MessageEvent<InMsg>) => void): void
}
const ctx = self as unknown as WorkerScope
const MANIFEST_URL = '/data/qindex/manifest.json'

let engine: QIndexEngine | null = null
let manifest: QIndexManifest | null = null
let loading: Promise<{ count: number; latestDate: string; version: string; ms: number }> | null = null

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return (await res.json()) as T
}

async function load(id: number) {
  const t0 = performance.now()
  const m = await fetchJson<QIndexManifest>(MANIFEST_URL)
  const files = m.types.flatMap((t) => t.chunks)
  const totalBytes = files.reduce((s, c) => s + c.bytes, 0)
  const chunks: QIndexChunk[] = new Array(files.length)
  let loaded = 0
  let bytes = 0
  let next = 0
  const fetchNext = async () => {
    while (next < files.length) {
      const i = next++
      chunks[i] = await fetchJson<QIndexChunk>('/data/' + files[i].file)
      loaded++
      bytes += files[i].bytes
      ctx.postMessage({ type: 'progress', id, phase: 'download', loaded, total: files.length, bytes, totalBytes })
    }
  }
  await Promise.all(Array.from({ length: 4 }, fetchNext))
  ctx.postMessage({ type: 'progress', id, phase: 'prepare', loaded, total: files.length, bytes, totalBytes })
  engine = new QIndexEngine(chunks, m.authorities, m.inApp)
  manifest = m
  return { count: engine.count, latestDate: m.latestDate, version: m.version, ms: Math.round(performance.now() - t0) }
}

ctx.addEventListener('message', (e) => {
  const msg = e.data
  void (async () => {
    try {
      if (msg.type === 'load') {
        loading ??= load(msg.id)
        ctx.postMessage({ type: 'loaded', id: msg.id, info: await loading })
        return
      }
      if (loading) await loading
      if (!engine || !manifest) throw new Error('فهرست بارگذاری نشده است')
      const response = msg.type === 'search' ? engine.search(msg.params) : engine.get(msg.qid)
      ctx.postMessage({ type: 'result', id: msg.id, response })
    } catch (err) {
      loading = null
      ctx.postMessage({ type: 'error', id: msg.id, error: err instanceof Error ? err.message : String(err) })
    }
  })()
})
