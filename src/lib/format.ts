import { toFaDigits } from './normalize'

/** نمایش عدد با ارقام فارسی و جداکننده هزارگان */
export function faNumber(n: number | string, opts: { group?: boolean } = {}): string {
  if (typeof n === 'number' && opts.group !== false) {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(n)
  }
  return toFaDigits(String(n))
}

/** نمایش ارقام بر اساس تنظیم کاربر */
export function digits(s: string | number, persian: boolean): string {
  return persian ? toFaDigits(String(s)) : String(s)
}

const jalaliFmt = (() => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return null
  }
})()

const jalaliShortFmt = (() => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return null
  }
})()

export function jalaliDate(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d
  return jalaliFmt ? jalaliFmt.format(date) : date.toLocaleDateString('fa-IR')
}

/** «1405/07/11» (ارقام لاتین) */
export function jalaliShort(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d
  if (!jalaliShortFmt) return date.toISOString().slice(0, 10)
  const parts = jalaliShortFmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}/${get('month')}/${get('day')}`
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return 'همین الان'
  if (min < 60) return `${faNumber(min)} دقیقه پیش`
  const h = Math.round(min / 60)
  if (h < 24) return `${faNumber(h)} ساعت پیش`
  const d = Math.round(h / 24)
  if (d < 30) return `${faNumber(d)} روز پیش`
  return jalaliDate(ts)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${faNumber(bytes)} بایت`
  if (bytes < 1024 * 1024) return `${faNumber(Math.round(bytes / 1024))} کیلوبایت`
  return `${faNumber(Math.round((bytes / 1024 / 1024) * 10) / 10)} مگابایت`
}

/** تومان با جداکننده */
export function toman(n: number): string {
  return `${new Intl.NumberFormat('fa-IR').format(Math.round(n))} تومان`
}

export function rial(n: number): string {
  return `${new Intl.NumberFormat('fa-IR').format(Math.round(n))} ریال`
}
