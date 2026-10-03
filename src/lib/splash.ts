/**
 * صفحه اسپلش (تعریف‌شده در index.html) — نمایش اعتبار پروژه هنگام اجرای اپ.
 *
 * اسپلش از نخستین رنگ‌آمیزی دیده می‌شود (حتی پیش از بارگذاری جاوااسکریپت) و پس از آماده‌شدن
 * نخستین صفحه، با حداقل زمان نمایش محو می‌شود تا متن اعتبار خوانا باشد. ضربه روی آن، آن را زودتر می‌بندد.
 * در هر نشست فقط یک بار نمایش داده می‌شود (کلاس splash-off در اسکریپت سرِ index.html).
 */
const MIN_VISIBLE_MS = 1300
const FADE_MS = 380

let done = false

export function dismissSplash(minVisibleMs = MIN_VISIBLE_MS) {
  if (done || typeof document === 'undefined') return
  const el = document.getElementById('splash')
  if (!el) return
  done = true
  if (document.documentElement.classList.contains('splash-off')) {
    el.remove()
    return
  }
  const hide = () => {
    el.classList.add('splash-hide')
    window.setTimeout(() => el.remove(), FADE_MS)
  }
  const wait = Math.max(0, minVisibleMs - performance.now())
  const timer = window.setTimeout(hide, wait)
  el.addEventListener(
    'click',
    (e) => {
      // پیوند وب‌سایت توسعه‌دهنده باید کار کند؛ بقیه نقاط اسپلش را می‌بندند
      if ((e.target as HTMLElement | null)?.closest('a')) return
      window.clearTimeout(timer)
      hide()
    },
    { passive: true },
  )
}
