/** ارتباط رشته اصلی با Web Worker جستجو */
import { useSyncExternalStore } from 'react'
import type { SearchFilters, SearchResponse } from '../types'

export interface SearchStatus {
  state: 'idle' | 'loading' | 'building' | 'saving' | 'ready' | 'empty' | 'error'
  count?: number
  source?: 'cache' | 'built' | 'empty'
  ms?: number
  loaded?: number
  total?: number
  error?: string
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; onProgress?: (p: any) => void }>()
let status: SearchStatus = { state: 'idle' }
const listeners = new Set<() => void>()

function setStatus(s: SearchStatus) {
  status = s
  listeners.forEach((l) => l())
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../../workers/search.worker.ts', import.meta.url), { type: 'module', name: 'search' })
  worker.addEventListener('message', (e: MessageEvent<any>) => {
    const msg = e.data
    if (msg.type === 'progress') {
      setStatus({ ...status, state: msg.phase, loaded: msg.loaded, total: msg.total })
      return
    }
    if (msg.type === 'data-progress') {
      pending.get(msg.id)?.onProgress?.(msg.progress)
      return
    }
    if (msg.type === 'ready') {
      const info = msg.info ?? {}
      setStatus({ state: info.source === 'empty' ? 'empty' : 'ready', count: info.count, source: info.source, ms: info.ms })
    }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.type === 'error') p.reject(new Error(msg.error))
    else p.resolve(msg.type === 'result' ? msg.response : msg.type === 'done' ? msg.result : msg.info)
  })
  worker.addEventListener('error', (e) => {
    setStatus({ state: 'error', error: e.message })
  })
  return worker
}

function call<T>(msg: Record<string, unknown>, onProgress?: (p: any) => void): Promise<T> {
  const id = ++seq
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress })
    getWorker().postMessage({ ...msg, id })
  })
}

/** نصب داده‌ها در Web Worker (JSON.parse و نوشتن IndexedDB خارج از رشته اصلی) */
export function workerInstall<T>(onProgress?: (p: any) => void): Promise<T> {
  setStatus({ state: 'loading' })
  return call<T>({ type: 'install' }, onProgress)
}

/** به‌روزرسانی افزایشی داده‌ها در Web Worker */
export function workerUpdate<T>(onProgress?: (p: any) => void): Promise<T> {
  return call<T>({ type: 'update' }, onProgress)
}

export function initSearch() {
  if (status.state === 'idle' || status.state === 'error' || status.state === 'empty') setStatus({ state: 'loading' })
  return call<SearchStatus>({ type: 'init' })
}

/** پس از به‌روزرسانی داده‌ها ایندکس را از نو بارگذاری می‌کند */
export function resetSearch() {
  setStatus({ state: 'loading' })
  return call<SearchStatus>({ type: 'reset' })
}

export interface SearchOptions {
  filters?: SearchFilters
  limit?: number
  semantic?: boolean
  instant?: boolean
}

export function searchLaws(query: string, opts: SearchOptions = {}): Promise<SearchResponse> {
  return call<SearchResponse>({ type: 'search', query, ...opts })
}

export function useSearchStatus(): SearchStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
    () => status,
  )
}
