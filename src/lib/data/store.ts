/** وضعیت داده‌ها در رابط کاربری: نصب اولیه، به‌روزرسانی، اعلان تغییر مواد نشان‌شده */
import { useSyncExternalStore } from 'react'
import { db } from '../db'
import { initSearch, workerInstall, workerUpdate } from '../search/client'
import { getSettings } from '../settings'
import { toast } from '../toast'
import { toFaDigits } from '../normalize'
import type { DatasetMeta } from '../types'
import { bookmarkedAmong, checkForUpdate, getDatasetMeta, type ImportProgress, type UpdateResult } from './sync'

export interface DataState {
  state: 'checking' | 'installing' | 'ready' | 'updating' | 'error' | 'offline'
  progress?: ImportProgress
  meta?: DatasetMeta
  error?: string
  lastCheck?: number
  updateAvailable?: string
}

let state: DataState = { state: 'checking' }
const listeners = new Set<() => void>()
const set = (patch: Partial<DataState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

let started = false

export async function startData() {
  if (started) return
  started = true
  const meta = await getDatasetMeta().catch(() => undefined)
  if (meta?.complete) {
    set({ state: 'ready', meta })
    void initSearch()
    // بررسی بی‌صدای نسخه جدید
    if (navigator.onLine && getSettings().autoUpdate) setTimeout(() => void refreshData({ silent: true }), 4000)
    return
  }
  if (!navigator.onLine && !meta) {
    set({ state: 'offline' })
    const onOnline = () => {
      window.removeEventListener('online', onOnline)
      started = false
      void startData()
    }
    window.addEventListener('online', onOnline)
    return
  }
  await install()
}

async function install() {
  set({ state: 'installing', error: undefined })
  try {
    const meta = await workerInstall<DatasetMeta>((p: ImportProgress) => set({ progress: p }))
    set({ state: 'ready', meta, lastCheck: Date.now() })
    void requestPersistentStorage()
  } catch (e) {
    set({ state: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) })
  }
}

export function retryInstall() {
  return install()
}

/** درخواست ذخیره‌سازی ماندگار تا مرورگر داده‌های آفلاین را پاک نکند */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* ignore */
  }
}

export async function refreshData(opts: { silent?: boolean } = {}): Promise<UpdateResult | null> {
  if (!navigator.onLine) {
    if (!opts.silent) toast('اتصال اینترنت برقرار نیست؛ داده‌های ذخیره‌شده نمایش داده می‌شوند.')
    return null
  }
  if (state.state === 'installing' || state.state === 'updating') return null
  try {
    const check = await checkForUpdate()
    set({ lastCheck: Date.now() })
    if (!check.available) {
      if (!opts.silent) toast(`داده‌ها به‌روز است (نسخه ${toFaDigits(check.latest)})`, { tone: 'success' })
      return { updated: false, to: check.latest, changedArticleIds: [], method: 'none' }
    }
    set({ state: 'updating', updateAvailable: check.latest })
    // ایندکس جستجو پس از به‌روزرسانی، خودکار در همان Worker بازسازی می‌شود
    const result = await workerUpdate<UpdateResult>((p: ImportProgress) => set({ progress: p }))
    const meta = await getDatasetMeta()
    set({ state: 'ready', meta, updateAvailable: undefined })
    if (result.updated) {
      toast(`داده‌ها به نسخه ${toFaDigits(result.to)} به‌روز شد (${toFaDigits(result.changedArticleIds.length)} ماده تغییر کرد).`, {
        tone: 'success',
        duration: 4000,
      })
      await notifyBookmarkChanges(result.changedArticleIds)
    }
    return result
  } catch (e) {
    set({ state: state.meta ? 'ready' : 'error', error: e instanceof Error ? e.message : String(e) })
    if (!opts.silent) toast('به‌روزرسانی ناموفق بود؛ بعداً دوباره تلاش کنید.', { tone: 'error' })
    return null
  }
}

/** اعلان محلی برای تغییر مواد نشان‌شده */
export async function notifyBookmarkChanges(changedIds: string[]) {
  if (!getSettings().notifyBookmarkChanges) return
  const ids = await bookmarkedAmong(changedIds)
  if (!ids.length) return
  const arts = (await db.articles.bulkGet(ids)).filter(Boolean)
  const body = arts
    .slice(0, 3)
    .map((a) => `${a!.lawTitle} — ${toFaDigits(a!.label)}`)
    .join('، ')
  toast(`تغییر در ${toFaDigits(ids.length)} ماده نشان‌شده: ${body}`, { duration: 6000 })
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.getRegistration()
      const title = 'تغییر در مواد نشان‌شده'
      const options: NotificationOptions = { body, icon: '/icons/192.png', badge: '/icons/192.png', dir: 'rtl', lang: 'fa', tag: 'bookmark-changes', data: { url: '/bookmarks' } }
      if (reg) await reg.showNotification(title, options)
      else new Notification(title, options)
    }
  } catch {
    /* ignore */
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useDataState(): DataState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

/**
 * انتخاب بخشی از وضعیت داده‌ها؛ مؤلفه فقط وقتی همان بخش تغییر کند دوباره رندر می‌شود
 * (مثلاً صفحه خانه با هر پیام پیشرفت نصب داده‌ها رندر نمی‌شود — کاهش TBT در بار اول).
 */
export function useDataSelector<T>(select: (s: DataState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state))
}
