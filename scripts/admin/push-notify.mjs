#!/usr/bin/env node
/**
 * ارسال اعلان Web Push به مشترکان (پس از انتشار نسخه جدید داده)
 *
 * پیش‌نیاز:
 *   npx web-push generate-vapid-keys        → کلید عمومی در VITE_VAPID_PUBLIC_KEY (زمان build)
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT=mailto:you@example.com
 *   subscriptions.json: آرایه‌ای از PushSubscription که اپ به VITE_PUSH_SUBSCRIBE_URL ارسال کرده است
 *
 * اجرا:
 *   node scripts/admin/push-notify.mjs --subs subscriptions.json --title "به‌روزرسانی قوانین" --body "نسخه ۱.۱.۰ منتشر شد"
 *
 * پیام با type=data-update ارسال می‌شود؛ Service Worker پس از دریافت، داده‌ها را در پس‌زمینه به‌روز
 * و در صورت تغییر مواد نشان‌شده، اعلان جداگانه نمایش می‌دهد. هیچ داده شخصی کاربر به سرور نمی‌رسد.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    subs: { type: 'string', default: 'subscriptions.json' },
    title: { type: 'string', default: 'به‌روزرسانی کتابچه قانون' },
    body: { type: 'string', default: 'قوانین جدید یا اصلاحات تازه در دسترس است.' },
    url: { type: 'string', default: '/' },
  },
})

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:admin@example.com' } = process.env
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY را تنظیم کنید (npx web-push generate-vapid-keys).')
  process.exit(1)
}

const webpush = (await import('web-push')).default
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const subs = JSON.parse(readFileSync(values.subs, 'utf8'))
const payload = JSON.stringify({ type: 'data-update', title: values.title, body: values.body, url: values.url })
const alive = []
let ok = 0
for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24 * 3 })
    ok++
    alive.push(sub)
  } catch (e) {
    if (e.statusCode !== 404 && e.statusCode !== 410) alive.push(sub)
    console.warn('✗', e.statusCode ?? e.message)
  }
}
writeFileSync(values.subs, JSON.stringify(alive, null, 1))
console.log(`✓ ${ok}/${subs.length} اعلان ارسال شد؛ اشتراک‌های منقضی حذف شدند.`)
