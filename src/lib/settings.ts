/** تنظیمات کاربر (محلی؛ localStorage) */
import { useSyncExternalStore } from 'react'

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  readerFont: 'vazirmatn' | 'naskh'
  fontScale: number
  lineHeight: number
  justify: boolean
  readerTheme: 'auto' | 'sepia'
  persianDigits: boolean
  haptics: boolean
  semanticSearch: boolean
  notifyBookmarkChanges: boolean
  autoUpdate: boolean
  installDismissedAt?: number
}

const KEY = 'kq:settings'
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  readerFont: 'vazirmatn',
  fontScale: 17,
  lineHeight: 2,
  justify: true,
  readerTheme: 'auto',
  persianDigits: true,
  haptics: true,
  semanticSearch: true,
  notifyBookmarkChanges: true,
  autoUpdate: true,
}

function load(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let current: Settings = typeof localStorage !== 'undefined' ? load() : { ...DEFAULT_SETTINGS }
const listeners = new Set<() => void>()
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null

export function getSettings() {
  return current
}

export function isDark(s: Settings = current) {
  return s.theme === 'dark' || (s.theme === 'system' && !!media?.matches)
}

let naskhLoaded = false
async function ensureReaderFont(font: Settings['readerFont']) {
  if (font === 'naskh' && !naskhLoaded) {
    naskhLoaded = true
    await Promise.all([import('@fontsource/noto-naskh-arabic/arabic-400.css'), import('@fontsource/noto-naskh-arabic/arabic-700.css')])
  }
}

export function applySettings(s: Settings = current) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const dark = isDark(s)
  root.classList.toggle('dark', dark)
  root.style.setProperty('--reader-size', `${s.fontScale}px`)
  root.style.setProperty('--reader-leading', String(s.lineHeight))
  root.style.setProperty('--reader-font', s.readerFont === 'naskh' ? 'var(--font-naskh)' : 'var(--font-sans)')
  void ensureReaderFont(s.readerFont)
  const color = dark ? '#0a1412' : '#0f766e'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* حالت خصوصی مرورگر */
  }
  applySettings(current)
  listeners.forEach((l) => l())
}

media?.addEventListener('change', () => {
  if (current.theme === 'system') applySettings(current)
  listeners.forEach((l) => l())
})

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => current,
  )
}
