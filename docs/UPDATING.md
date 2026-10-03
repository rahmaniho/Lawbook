<div dir="rtl">

# راهنمای به‌روزرسانی دوره‌ای (هفتگی)

## چرخه پیشنهادی

| گام | ابزار | خروجی |
|---|---|---|
| ۱. پایش مصوبات تازه | `python scripts/admin/rrk_watch.py` (یا GitHub Action هفتگی `.github/workflows/weekly-data-watch.yml`) | گزارش مصوبات تازه روزنامه رسمی و ارتباط آن‌ها با قوانین موجود (Issue خودکار) |
| ۲. برداشت متن تلفیقی جدید | `python scripts/scraper/qavanin_playwright.py fetch <شناسه> --slug <file>` (یا `catalog` برای همه موارد در انتظار) | فایل خام به‌روز + `.meta.json` |
| ۳. ساخت و کنترل کیفیت | `npm run data:laws` | `data/laws/*.json`، `data/qa-report.md`، `docs/COVERAGE.md` |
| ۴. بازبینی انسانی | `git diff data/laws` | تغییرات ماده‌به‌ماده قابل بررسی (فرمت JSON خط‌به‌خط) |
| ۵. انتشار نسخه | `npm run data -- --release` | افزایش خودکار نسخه + `data/patches/<from>_<to>.json` |
| ۶. استقرار | push به main ← CI ← Vercel/Netlify | کاربران فقط patch را دریافت می‌کنند |
| ۷. اعلان (اختیاری) | `node scripts/admin/push-notify.mjs` | اعلان Push؛ SW به‌روزرسانی را در پس‌زمینه اعمال می‌کند |

## به‌روزرسانی فهرست مصوبات

فهرست عناوین (`data/raw/qavanin-index/qavanin-list.tsv.gz`) تا تاریخ **۱۴۰۱/۰۱/۳۰** است. برای افزودن مصوبات جدیدتر (از شبکه داخل ایران؛
سامانه پشت چالش ArvanCloud است و Playwright آن را حل می‌کند):

```bash
pip install -r scripts/scraper/requirements.txt -r scripts/pipeline/requirements.txt && playwright install chromium
# برداشت فهرست (هر صفحه ۱۰۰۰ ردیف، یک صفحه در ≥۸ ثانیه؛ با قطع اتصال، اجرای دوباره از همان صفحه ادامه می‌دهد)
python scripts/scraper/qavanin_playwright.py list --out scripts/scraper/output/qavanin-list.tsv
# ادغام با فهرست موجود (ردیف‌های هم‌شناسه به‌روز، ردیف‌های جدید افزوده می‌شوند)
python scripts/pipeline/import_qavanin_list.py --tsv scripts/scraper/output/qavanin-list.tsv --merge
npm run data:laws && npm run data -- --release    # خلاصه فهرست در کاتالوگ به‌روز و به کاربران ارسال می‌شود
```

بسته‌های فهرست نام هش‌دار دارند؛ کاربرانی که فهرست را آفلاین ذخیره کرده‌اند، با باز کردن صفحه «فهرست مصوبات» فقط بسته‌های تغییرکرده را
دریافت می‌کنند. برای هر مصوبه‌ای که متن کاملش وارد اپ شود، `source.qavaninId` در کاتالوگ آن را در فهرست با نشان «متن کامل در اپ» پیوند می‌دهد.

## نسخه‌بندی معنایی داده

`scripts/bundle-data.ts --release` اثرانگشت مواد را با آخرین انتشار (`data/releases/*.json`) مقایسه می‌کند:

- **major**: حذف یک قانون کامل (یا تغییر ناسازگار ساختار)
- **minor**: افزودن قانون، ماده یا مورد جدید کاتالوگ
- **patch**: اصلاح متن مواد موجود (تصحیح، اعمال اصلاحیه) یا فراداده قوانین

سطح را می‌توان دستی تعیین کرد: `npm run data -- --release --level=minor`. اثرانگشت نسخه شامل هش کاتالوگ است، پس تغییر دسته‌ها، موارد
جدید و پیوندهای رسمی هم به کاربران می‌رسد (نمونه: انتشار ۱.۱.۰ با patch ۱۵۰KB شامل ۲۰ جایگزینی فراداده قانون).

و فایل JSON Patch (RFC 6902) با عملیات `add`/`replace`/`remove` روی مسیرهای `/laws/<id>` و `/articles/<lawId:key>` می‌سازد.

## رفتار کلاینت

1. هنگام باز شدن اپ (اگر «به‌روزرسانی خودکار» روشن باشد)، با Pull-to-Refresh، یا از تنظیمات ← «بررسی به‌روزرسانی».
2. `manifest.json` با Network-First دریافت و اثرانگشت مقایسه می‌شود.
3. اگر زنجیره patch از نسخه فعلی تا آخرین موجود باشد، فقط patchها (چند کیلوبایت) اعمال می‌شوند؛ وگرنه فقط بسته‌های قوانینی که تغییر کرده‌اند دوباره دریافت می‌شوند.
4. ایندکس جستجو بازسازی می‌شود و اگر ماده‌ای نشان‌شده تغییر کرده باشد، اعلان (Toast + Notification) نمایش داده می‌شود.
5. در حالت آفلاین، درخواست به‌روزرسانی با Background Sync ثبت و پس از اتصال اجرا می‌شود؛ Periodic Sync هفتگی نیز (در Chrome/Edge پس از نصب) همین کار را می‌کند.

## پنل ادمین (آینده)

`rrk_watch.py` هسته پنل ادمین است: یک داشبورد کوچک می‌تواند گزارش هفتگی را نمایش دهد، برای هر مورد مرتبط دکمه «برداشت و مقایسه» داشته باشد (اجرای scraper و نمایش diff ماده‌به‌ماده) و پس از تأیید، انتشار نسخه و ارسال Push را انجام دهد.

</div>
