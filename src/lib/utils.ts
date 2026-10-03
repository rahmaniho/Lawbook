import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** کلید ماده در URL: «499-bis» ← «499-bis» (بدون تغییر)، فقط encode */
export function articlePath(lawId: string, key: string) {
  return `/law/${encodeURIComponent(lawId)}/${encodeURIComponent(key)}`
}

export function lawPath(lawId: string) {
  return `/law/${encodeURIComponent(lawId)}`
}

export function splitArticleId(id: string): { lawId: string; key: string } {
  const i = id.indexOf(':')
  return { lawId: id.slice(0, i), key: id.slice(i + 1) }
}
