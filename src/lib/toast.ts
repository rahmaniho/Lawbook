import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  message: string
  tone?: 'default' | 'success' | 'error'
  action?: { label: string; onClick: () => void }
  duration?: number
}

let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(message: string, opts: Omit<Toast, 'id' | 'message'> = {}) {
  const t: Toast = { id: ++seq, message, duration: 2600, ...opts }
  toasts = [...toasts.slice(-2), t]
  emit()
  setTimeout(() => dismissToast(t.id), t.duration)
  return t.id
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => toasts,
    () => toasts,
  )
}
