import { useEffect, useSyncExternalStore } from 'react'

let deferred: BeforeInstallPromptEvent | null = null
let installed = typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
let snapshot = { canPrompt: false, installed }

function refresh() {
  snapshot = { canPrompt: !!deferred, installed }
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    refresh()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    refresh()
  })
}

export function isIos() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  await deferred.prompt()
  const choice = await deferred.userChoice
  deferred = null
  refresh()
  return choice.outcome
}

export function useInstallPrompt() {
  useEffect(() => {
    refresh()
  }, [])
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
    () => snapshot,
  )
}
