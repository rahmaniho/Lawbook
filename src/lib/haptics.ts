import { getSettings } from './settings'

const PATTERNS = {
  light: 8,
  medium: 16,
  success: [10, 40, 18],
  warning: [24, 60, 24],
} as const

/** بازخورد لمسی (روی دستگاه‌هایی که Vibration API دارند) */
export function haptic(kind: keyof typeof PATTERNS = 'light') {
  if (!getSettings().haptics) return
  try {
    navigator.vibrate?.(PATTERNS[kind] as number | number[])
  } catch {
    /* ignore */
  }
}
