import type { Article } from './types'
import { toFaDigits } from './normalize'
import { articlePath } from './utils'

export const DISCLAIMER = 'این اپلیکیشن ابزار کمکی است و مرجع رسمی، روزنامه رسمی و سامانه ملی قوانین است'

export function articleUrl(a: Pick<Article, 'lawId' | 'key'>) {
  return `${location.origin}${articlePath(a.lawId, a.key)}`
}

/** متن اشتراک: نام قانون + شماره ماده + متن (+ تبصره‌ها) */
export function articleShareText(a: Article, lawTitle: string, persian = true) {
  const d = (s: string) => (persian ? toFaDigits(s) : s)
  const parts = [`📘 ${lawTitle} — ${d(a.label)}`, '', d(a.text)]
  if (a.notes?.length) parts.push('', ...a.notes.map(d))
  parts.push('', `🔗 ${articleUrl(a)}`, `(${DISCLAIMER})`)
  return parts.join('\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export async function shareArticle(a: Article, lawTitle: string, persian = true): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = articleShareText(a, lawTitle, persian)
  const title = `${lawTitle} — ${persian ? toFaDigits(a.label) : a.label}`
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
