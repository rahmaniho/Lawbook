/** ارتباط رشته اصلی با Web Worker «فهرست مصوبات» + مدیریت نسخه آفلاین آن */
import { useSyncExternalStore } from 'react'
import type { QIndexManifest, QType } from './model'

export interface QSearchParams {
  q?: string
  types?: QType[]
  authority?: string
  yearFrom?: number
  yearTo?: number
  sort?: 'relevance' | 'newest' | 'oldest'
  offset?: number
  limit?: number
}

export interface QEntryOut {
  id: number
  title: string
  date: string
  authority: string
  type: QType
  /** شناسه قانون دارای متن کامل در اپ */
  lawId?: string
}

export interface QSearchResponse {
  query: string
  total: number
  items: QEntryOut[]
  byType: Partial<Record<QType, number>>
  tookMs: number
  sort: NonNullable<QSearchParams['sort']>
}

export interface QIndexStatus {
  state: 'idle' | 'download' | 'prepare' | 'ready' | 'error'
  loaded?: number
  total?: number
  bytes?: number
  totalBytes?: number
  count?: number
  ms?: number
  error?: string
}

export const QINDEX_CACHES = ['qindex', 'qindex-manifest']
export const QINDEX_MANIFEST_URL = '/data/qindex/manifest.json'

let worker: Worker | null = null
let seq = 0
let loadPromise: Promise<QIndexStatus> | null = null
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
let status: QIndexStatus = { state: 'idle' }
const listeners = new Set<() => void>()

function setStatus(s: QIndexStatus) {
  status = s
  listeners.forEach((l) => l())
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../../workers/qindex.worker.ts', import.meta.url), { type: 'module', name: 'qindex' })
  worker.addEventListener('message', (e: MessageEvent<any>) => {
    const msg = e.data
    if (msg.type === 'progress') {
      setStatus({ state: msg.phase, loaded: msg.loaded, total: msg.total, bytes: msg.bytes, totalBytes: msg.totalBytes })
      return
    }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.type === 'error') p.reject(new Error(msg.error))
    else p.resolve(msg.type === 'loaded' ? msg.info : msg.response)
  })
  worker.addEventListener('error', (e) => setStatus({ state: 'error', error: e.message }))
  return worker
}

function call<T>(msg: Record<string, unknown>): Promise<T> {
  const id = ++seq
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ ...msg, id })
  })
}

/** بارگذاری فهرست در Worker (یک بار در هر نشست؛ دفعات بعد از Cache Storage) */
export function loadQIndex(): Promise<QIndexStatus> {
  if (loadPromise) return loadPromise
  setStatus({ state: 'download', loaded: 0, total: 0 })
  loadPromise = call<{ count: number; ms: number }>({ type: 'load' })
    .then((info) => {
      const s: QIndexStatus = { state: 'ready', count: info.count, ms: info.ms }
      setStatus(s)
      return s
    })
    .catch((err: Error) => {
      loadPromise = null
      setStatus({ state: 'error', error: err.message })
      throw err
    })
  return loadPromise
}

export async function searchQIndex(params: QSearchParams): Promise<QSearchResponse> {
  await loadQIndex()
  return call<QSearchResponse>({ type: 'search', params })
}

export async function getQEntry(qid: number): Promise<QEntryOut | null> {
  await loadQIndex()
  return call<QEntryOut | null>({ type: 'get', qid })
}

/** آزادسازی حافظه (~۵۰MB) هنگام خروج از صفحه فهرست */
export function releaseQIndex() {
  worker?.terminate()
  worker = null
  loadPromise = null
  pending.clear()
  setStatus({ state: 'idle' })
}

export function useQIndexStatus(): QIndexStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
    () => status,
  )
}

// ---------------------------------------------------------------------------
// نسخه آفلاین: بسته‌ها با راهبرد Cache-First در Cache Storage («qindex») نگه داشته می‌شوند.

export async function fetchQIndexManifest(): Promise<QIndexManifest | null> {
  try {
    const res = await fetch(QINDEX_MANIFEST_URL)
    return res.ok ? ((await res.json()) as QIndexManifest) : null
  } catch {
    return null
  }
}

/** چند بسته از فهرست در دستگاه ذخیره شده است؟ */
export async function qindexOfflineState(manifest?: QIndexManifest | null): Promise<{ cached: number; total: number; bytes: number } | null> {
  if (typeof caches === 'undefined') return null
  const m = manifest ?? (await fetchQIndexManifest())
  if (!m) return null
  const files = m.types.flatMap((t) => t.chunks)
  const cache = await caches.open('qindex')
  let cached = 0
  let bytes = 0
  await Promise.all(
    files.map(async (f) => {
      if (await cache.match('/data/' + f.file)) {
        cached++
        bytes += f.bytes
      }
    }),
  )
  return { cached, total: files.length, bytes }
}

export async function clearQIndexOffline() {
  releaseQIndex()
  if (typeof caches === 'undefined') return
  await Promise.all(QINDEX_CACHES.map((c) => caches.delete(c)))
}

let releaseTimer: ReturnType<typeof setTimeout> | null = null
/** پس از خروج از صفحه فهرست، حافظه Worker با تأخیر آزاد می‌شود (بازگشت سریع بدون بارگذاری مجدد) */
export function scheduleQIndexRelease(ms = 120_000) {
  cancelQIndexRelease()
  releaseTimer = setTimeout(releaseQIndex, ms)
}
export function cancelQIndexRelease() {
  if (releaseTimer) clearTimeout(releaseTimer)
  releaseTimer = null
}
