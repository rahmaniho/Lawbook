<div dir="rtl">

# کتابچه قانون ایران 📘

اپلیکیشن وب پیش‌رونده (PWA) برای **مرور، جستجو و مطالعه آفلاین قوانین جمهوری اسلامی ایران** — قابل نصب روی صفحه اصلی گوشی، با تجربه‌ای شبیه اپ‌های بومی.

> **این اپلیکیشن ابزار کمکی است و مرجع رسمی، روزنامه رسمی و سامانه ملی قوانین است**

<p align="center">
  <img src="docs/images/home.webp" width="200" alt="صفحه خانه" />
  <img src="docs/images/article.webp" width="200" alt="متن ماده" />
  <img src="docs/images/search.webp" width="200" alt="جستجو" />
  <img src="docs/images/home-dark.webp" width="200" alt="حالت تیره" />
</p>

## آنچه در این نسخه هست

| | |
|---|---|
| **داده‌ها** | ۲۰ قانون اصلی با **متن کامل و تلفیقی (با اصلاحات)** — ۵٬۹۰۴ ماده/اصل؛ ۱۶ مورد دیگر در فهرست با برچسب «در انتظار ورود متن» ([وضعیت پوشش](docs/COVERAGE.md)) |
| **آفلاین** | پس از اولین بار (~۶۵۰KB با Brotli)، همه قوانین، جستجو، نشان‌ها و یادداشت‌ها بدون اینترنت کار می‌کنند |
| **جستجو** | پنج لایه: شماره ماده («ماده ۱۰ قانون مدنی»، «م ۱۰ ق.م»، «اصل ۴۴»)، کلیدواژه (BM25)، عبارت دقیق («…»)، فازی (تحمل غلط تایپی) و مفهومی (هم‌معناها) — در Web Worker؛ معمولاً **زیر ۲۰ میلی‌ثانیه** |
| **نرمال‌سازی** | ي/ك ← ی/ک، اعراب، کشیده، نیم‌فاصله، ارقام فارسی/عربی ← لاتین، همزه‌ها |
| **رابط کاربری** | RTL کامل، قلم وزیرمتن (خودمیزبان)، ناوبری پایین ۵ زبانه، Bottom Sheet، کارت‌های قابل کشیدن (راست: نشان، چپ: اشتراک)، Pull-to-Refresh، اسکلتون، حالت تیره خودکار/دستی، حالت مطالعه (قلم/اندازه/فاصله خطوط/سپیا) |
| **امکانات** | نشان‌گذاری، یادداشت شخصی، تاریخچه جستجو، اشتراک متن ماده، کپی سریع، QR، محاسبه‌گر ارث و دیه (با استناد به مواد قانون)، اعلان تغییر مواد نشان‌شده، پشتیبان‌گیری JSON |
| **حریم خصوصی** | Local-first؛ هیچ حساب کاربری، کوکی یا ابزار ردیابی |
| **به‌روزرسانی** | نسخه‌بندی معنایی (semver) و ارسال فقط تغییرات با **JSON Patch** (RFC 6902)؛ Background Sync و Periodic Sync |

### دقت حقوقی

- هیچ متنی تولید، خلاصه یا بازنویسی نشده است. متن‌ها «متن تلفیقی» **سامانه ملی قوانین و مقررات (qavanin.ir)** هستند که از یک برداشت متن‌باز (MIT) بایگانی‌شده در تاریخ **۱۴۰۳/۰۲/۱۵** گرفته شده‌اند ([منشأ کامل](data/SOURCES.md)).
- تاریخ آخرین به‌روزرسانی متن کنار هر قانون و هر ماده نمایش داده می‌شود؛ اصلاحات پس از آن تاریخ باید با ابزار برداشت وارد شوند.
- کنترل کیفیت خودکار ([`data/qa-report.md`](data/qa-report.md)): پیوستگی شماره مواد، تکرار، مواد بدون متن؛ تعداد مواد با مراجع تطبیق دارد (قانون اساسی ۱۷۷ اصل، قانون مدنی ۱۳۳۵ ماده، آیین دادرسی مدنی ۵۲۹ ماده و ۷۲ تبصره، قانون کار ۲۰۳ ماده).
- مواد منسوخ و اصلاحی با برچسب، و نشانگرهای «(اصلاحی …)» و «[… الحاق شده است]» عیناً و متمایز نمایش داده می‌شوند.

## شروع سریع

پیش‌نیاز: Node.js 20+ (و Python 3.11 فقط برای بازسازی داده‌ها)

```bash
npm install
npm run dev        # http://localhost:5173  (پیش از اجرا داده‌ها بسته‌بندی می‌شوند)
npm run build      # خروجی در dist/
npm run preview    # پیش‌نمایش نسخه تولیدی (Service Worker فعال) روی :4173
npm test           # تست‌های TypeScript (نرمال‌سازی، پرس‌وجو، ارث، دیه، همگام‌سازی JSON Patch)
npm run test:py    # تست‌های پایتون (نرمال‌سازی و تجزیه‌گر متن قوانین)
npm run size       # گزارش حجم بار اول و داده‌ها (gzip/brotli)
```

## معماری در یک نگاه

```
data/raw/qavanin-text/*.txt ──(Python: normalize + parse + QA)──▶ data/laws/*.json  (متعارف، در Git)
                                                                        │
                                       (Node: scripts/bundle-data.ts)  ▼
public/data/manifest.json + catalog + chunks/*.json (≤۵۰۰KB) + patches/*.json (JSON Patch)
                                                                        │  fetch (SW: SWR / Network-First)
                                                                        ▼
            IndexedDB «GhanounDB» (Dexie) ◀──── Web Worker جستجو (MiniSearch، ایندکس کش‌شده)
                         ▲
              React + Vite + Tailwind + framer-motion (RTL، code-splitting، virtual scroll)
```

جزئیات: [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [DATA_PIPELINE.md](docs/DATA_PIPELINE.md) · [DEPLOYMENT.md](docs/DEPLOYMENT.md) · [UPDATING.md](docs/UPDATING.md) · [COVERAGE.md](docs/COVERAGE.md)

## ساختار پروژه

```
src/
  pages/            صفحات (خانه، قوانین، قانون، ماده، جستجو، نشان‌ها، تنظیمات، ابزارها، درباره)
  components/       اجزای رابط (AppBar، BottomNav، Sheet، ArticleCard، TocTree، …)
  lib/              db (Dexie)، data/sync (نصب و JSON Patch)، search (موتور و تحلیل پرس‌وجو)،
                    normalize، inheritance، diyeh، settings، share، …
  workers/          search.worker.ts
  sw.ts             Service Worker (Workbox: precache، SWR، Background/Periodic Sync، Push)
scripts/
  pipeline/         normalize_fa.py، parse_qavanin.py، build_laws.py، export_sqlite.py، gen_docs.py + tests
  scraper/          qavanin_playwright.py (Playwright)، fetch_http.py (BeautifulSoup)، polite.py (robots.txt/نرخ)
  admin/            rrk_watch.py (پایش هفتگی روزنامه رسمی)، push-notify.mjs (Web Push)
  semantic/         build_embeddings.py (اختیاری: بردارهای معنایی برای sqlite-vec/pgvector)
  bundle-data.ts    بسته‌بندی داده و ساخت patch نسخه‌ها
data/
  catalog.json      فهرست قوانین (۳۶ مورد)، سلسله‌مراتب ۷ سطحی، ۱۰ دسته موضوعی
  glossary.json     واژه‌نامه مفاهیم حقوقی (کلیدواژه و جستجوی مفهومی)
  raw/              متن‌های خام + مجوز منبع     laws/  داده متعارف     releases/ patches/  نسخه‌ها
```

## خروجی‌های داده

- **JSON** متعارف هر قانون: `data/laws/<id>.json` (فهرست مطالب درختی، مواد، تبصره‌ها، اصلاحات، وضعیت، ارجاعات، کلیدواژه‌ها)
- **SQLite + FTS5**: `npm run data:sqlite` ← `data/build/lawbook.sqlite`
- **بسته‌های PWA**: `public/data/` (در زمان build ساخته می‌شود)

## مجوز و منابع

- متن قوانین، اسناد عمومی است. نسخه بایگانی‌شده از مخزن [HamedJahantigh-git/legal_chatbot](https://github.com/HamedJahantigh-git/legal_chatbot) (MIT) گرفته شده است — متن مجوز: `data/raw/qavanin-text/LICENSE.upstream.txt`.
- قلم‌ها: Vazirmatn و Noto Naskh Arabic (SIL OFL 1.1).

</div>

---

### English summary

**Ketabche Ghanoon** is an installable, offline-first React + Vite + TypeScript PWA for browsing and searching Iranian law. Version 1.0 ships 20 core laws (5,904 articles) as verbatim consolidated texts from the National Laws Portal (qavanin.ir), sourced through an MIT-licensed archive snapshot dated 2024-05-04. It features a five-layer search engine (MiniSearch in a Web Worker): article number, keyword, phrase, fuzzy, and glossary-based concept matching. Data is stored in IndexedDB via Dexie. Updates use semver and ship as JSON Patch deltas. The Python pipeline handles scraping (Playwright, robots.txt-aware), normalization, parsing, QA, and SQLite/FTS5 export. See `docs/` for architecture, deployment, update workflow, and coverage.
