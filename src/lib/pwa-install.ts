/**
 * پنجره نصب PWA با @khmyznikov/pwa-install (Web Component)
 *
 * - در Chrome/Edge اندروید و دسکتاپ: پنجره نصب غنی (آیکن، توضیح، تصاویر) و سپس پنجره بومی نصب
 * - در iOS/iPadOS/macOS Safari و مرورگرهای فاقد beforeinstallprompt (Firefox، Samsung و …):
 *   راهنمای تصویری «افزودن به صفحه اصلی» به سبک بومی همان سیستم‌عامل
 * - در مرورگرهای درون‌برنامه‌ای (تلگرام، اینستاگرام): راهنمای باز کردن در مرورگر
 *
 * کامپوننت (~۲۸KB brotli به‌همراه Lit) فقط هنگام نیاز به‌صورت تنبل بارگذاری می‌شود تا بسته اولیه سبک بماند.
 * رویداد beforeinstallprompt از ابتدای اجرا در hooks/useInstallPrompt نگه داشته و به کامپوننت تحویل داده می‌شود.
 */
import { getDeferredPrompt, markInstalled } from '../hooks/useInstallPrompt'

type PWAInstallElement = HTMLElement & {
  showDialog(forced?: boolean): void
  hideDialog(): void
  externalPromptEvent: BeforeInstallPromptEvent | null
  isUnderStandaloneMode: boolean
  updateComplete?: Promise<boolean>
}

const DESCRIPTION = 'اجرای تمام‌صفحه، دسترسی سریع از صفحه اصلی و جستجو و مطالعه قوانین کاملاً بدون اینترنت.'

let elementPromise: Promise<PWAInstallElement> | null = null

/** کامپوننت زبان را از navigator.language می‌خواند؛ اپ فارسی است، پس هنگام اتصال «fa» گزارش می‌شود. */
function withPersianLocale(fn: () => void) {
  let overridden = false
  try {
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'fa' })
    overridden = true
  } catch {
    // در برخی مرورگرها قابل بازنویسی نیست؛ زبان مرورگر استفاده می‌شود
  }
  try {
    fn()
  } finally {
    if (overridden) {
      try {
        delete (navigator as unknown as Record<string, unknown>).language
      } catch {
        // بی‌اثر
      }
    }
  }
}

function ensureElement(): Promise<PWAInstallElement> {
  if (elementPromise) return elementPromise
  elementPromise = (async () => {
    await import('@khmyznikov/pwa-install')
    await customElements.whenDefined('pwa-install')
    const el = document.createElement('pwa-install') as PWAInstallElement
    el.setAttribute('manifest-url', '/manifest.json')
    el.setAttribute('manual-apple', '')
    el.setAttribute('manual-chrome', '')
    el.setAttribute('install-description', DESCRIPTION)
    el.setAttribute('styles', JSON.stringify({ '--tint-color': '#0f766e' }))
    const deferred = getDeferredPrompt()
    if (deferred) el.externalPromptEvent = deferred
    el.addEventListener('pwa-install-success-event', () => markInstalled())
    el.addEventListener('pwa-user-choice-result-event', (e) => {
      if ((e as CustomEvent<{ message?: string }>).detail?.message === 'accepted') markInstalled()
    })
    withPersianLocale(() => document.body.appendChild(el))
    await el.updateComplete
    return el
  })().catch((err) => {
    elementPromise = null
    throw err
  })
  return elementPromise
}

/** نمایش پنجره نصب؛ در صورت شکست (مثلاً عدم بارگذاری ماژول) false برمی‌گرداند تا راهنمای داخلی نمایش داده شود. */
export async function openInstallDialog(): Promise<boolean> {
  try {
    const el = await ensureElement()
    const deferred = getDeferredPrompt()
    if (deferred && el.externalPromptEvent !== deferred) el.externalPromptEvent = deferred
    el.showDialog(true)
    return true
  } catch {
    return false
  }
}
