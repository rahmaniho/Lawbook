import { useSyncExternalStore } from 'react'

/** وضعیت سراسری رابط کاربری (مثلاً حالت مطالعه تمام‌صفحه) */
interface UiState {
  immersive: boolean
}
let state: UiState = { immersive: false }
const listeners = new Set<() => void>()

export function setUi(patch: Partial<UiState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useUi() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
}
