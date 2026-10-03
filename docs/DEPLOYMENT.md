<div dir="rtl">

# راهنمای استقرار

خروجی `npm run build` یک سایت **کاملاً ایستا** در `dist/` است و روی هر میزبان HTTPS قابل استقرار است (Service Worker فقط روی HTTPS یا localhost فعال می‌شود). داده‌ها در زمان build از `data/laws` ساخته می‌شوند؛ به پایتون روی سرور نیازی نیست.

## Vercel

1. مخزن را در Vercel وارد کنید (Framework: Vite).
2. تنظیمات از `vercel.json` خوانده می‌شود: `npm ci` ← `npm run build` ← `dist`، بازنویسی SPA و هدرهای کش:
   - `/assets/*`، `/data/chunks/*`، `/data/patches/*`، کاتالوگ/واژه‌نامه هش‌دار ← `immutable` یک‌ساله
   - `/data/manifest.json`، `/sw.js`، `/manifest.json` ← `no-cache`
3. (اختیاری) متغیرهای محیطی Push: `VITE_VAPID_PUBLIC_KEY`، `VITE_PUSH_SUBSCRIBE_URL`.

## Netlify

`netlify.toml` آماده است (Node 22، بازنویسی `/* → /index.html 200`، همان هدرهای کش). فقط مخزن را متصل کنید.

## میزبان ایستا (nginx)

```bash
npm run build:compress   # build + ساخت نسخه‌های .br و .gz کنار فایل‌ها
```

```nginx
server {
  listen 443 ssl http2;
  root /var/www/ketabche/dist;
  brotli_static on;          # ماژول ngx_brotli
  gzip_static on;

  location /assets/      { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location /data/chunks/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location /data/patches/{ add_header Cache-Control "public, max-age=31536000, immutable"; }
  location = /data/manifest.json { add_header Cache-Control "no-cache"; }
  location = /sw.js      { add_header Cache-Control "no-cache"; }
  location = /manifest.json { add_header Cache-Control "no-cache"; types { application/manifest+json json; } }
  location / { try_files $uri /index.html; }
}
```

## نکات استقرار در ایران

- همه منابع (قلم‌ها، کتابخانه‌ها، داده‌ها) خودمیزبان‌اند؛ اپ به هیچ CDN خارجی وابسته نیست و پس از اولین بارگذاری کاملاً آفلاین کار می‌کند.
- برای دسترس‌پذیری بهتر می‌توان `dist/` را روی میزبان‌های داخلی (مثلاً فضای ابری S3-سازگار + CDN داخلی) قرار داد؛ هدرهای بالا را تنظیم کنید.

## Push (اختیاری)

1. `npx web-push generate-vapid-keys`
2. کلید عمومی را در `VITE_VAPID_PUBLIC_KEY` (زمان build) قرار دهید؛ یک endpoint ساده (Serverless/Edge Function) برای دریافت اشتراک‌ها در `VITE_PUSH_SUBSCRIBE_URL` بسازید و آن‌ها را در `subscriptions.json` یا پایگاه داده ذخیره کنید.
3. پس از هر انتشار: `node scripts/admin/push-notify.mjs --subs subscriptions.json --body "نسخه … منتشر شد"`.

بدون Push نیز اپ هنگام باز شدن و به‌صورت هفتگی (Periodic Sync) نسخه جدید را بررسی و اعلان محلی تغییر مواد نشان‌شده را نمایش می‌دهد.

## Lighthouse

پس از استقرار روی HTTPS: Chrome DevTools ← Lighthouse ← Mobile. موارد کلیدی پیاده‌سازی‌شده: manifest کامل با آیکن maskable، Service Worker با پاسخ آفلاین، `theme-color`، متا viewport، کنتراست رنگ‌ها، برچسب‌های ARIA، فونت خودمیزبان و بار اول ~۲۰۰KB gzip.

</div>
