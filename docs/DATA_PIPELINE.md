<div dir="rtl">

# خط لوله داده

## قالب متن خام (qavanin-text)

```
قانون مدنی                                       ← سطر ۱: عنوان
مصوب 1307/02/18 مجلس شورای ملی با اصلاحات…      ← سطر ۲: تاریخ و مرجع تصویب
❯ جلد اول - در اموال                              ← عنوان بخش‌بندی (جلد/کتاب/قسمت/بخش/باب/فصل/مبحث/…)
ماده 11                                          ← شروع ماده (قانون اساسی: «اصل 11»؛ «ماده 6 مکرر»؛ «ماده واحده»)
متن ماده…
تبصره 1 - …                                       ← تبصره (تا تبصره بعدی یا پایان ماده)
[بند ح به موجب … الحاق شده است]                    ← یادداشت ویراستاری منبع (حفظ می‌شود)
```

این همان قالبی است که `scripts/scraper/extract.py` از HTML سامانه می‌سازد.

## مراحل

```bash
python3 scripts/pipeline/build_laws.py   # raw → data/laws/*.json + data/qa-report.md
python3 scripts/pipeline/gen_docs.py     # data/SOURCES.md + docs/COVERAGE.md
npm run data                             # data/laws → public/data (بسته‌ها)
npm run data:sqlite                      # اختیاری: data/build/lawbook.sqlite (FTS5)
npm run test:py                          # تست‌های نرمال‌ساز و تجزیه‌گر
```

### قواعد تجزیه (`parse_qavanin.py`)

- **سلسله‌مراتب عنوان‌ها** با رتبه طبیعی (جلد < کتاب < قسمت/بخش < باب < فصل < مبحث < گفتار < فقره) و قاعده «والد طبیعی» تا ساختارهای تودرتوی غیرعادی (مثل فصل «جرائم رایانه‌ای» که خود بخش/فصل/مبحث دارد) درست ساخته شوند. «مقدمه/کلیات» برگ‌اند.
- **تبصره‌ها**: از نخستین سطر «تبصره» به بعد؛ سطرهای بعدی تا تبصره بعدی به همان تبصره تعلق دارند.
- **اصلاحات**: نشانگرهای «(اصلاحی|الحاقی|منسوخ … تاریخ)» و یادداشت‌های «[…]» با تاریخ استخراج می‌شوند.
- **وضعیت**: «منسوخ» اگر متن کوتاه ماده حاکی از حذف/نسخ/الغا باشد؛ «اصلاحی» اگر نشانگر اصلاح/الحاق دارد؛ وگرنه «لازم‌الاجرا».
- **ارجاعات داخلی**: «ماده (۱۰)»، «مواد ۱۰ و ۱۲»، «مواد ۱۰ تا ۱۵» — به‌جز ارجاع به «قانون/آیین‌نامه/لایحه» دیگر.
- **برش (segment)**: یک فایل خام می‌تواند چند قانون داشته باشد؛ مثلاً کتاب پنجم مجازات (تعزیرات) و لایحه اصلاحی تجارت ۱۳۴۷ در کاتالوگ با `source.segment` جدا شده‌اند.

### کنترل کیفیت

`data/qa-report.md` برای هر قانون: تعداد مواد، تبصره، اصلاحی، منسوخ، عناوین و هشدارها (شماره‌های جاافتاده، کلید تکراری، ماده بی‌متن، تفاوت عنوان فایل با کاتالوگ). شکاف‌های مورد انتظار با `expectedGaps` در کاتالوگ مستند می‌شوند (مثلاً مواد ۲۱ تا ۹۴ قانون تجارت).

## افزودن قانون جدید

1. **یافتن شناسه** در سامانه ملی قوانین — ساده‌ترین راه: جستجوی عنوان در صفحه «فهرست مصوبات» اپ (شناسه در «مشخصات مصوبه»)
   یا در `data/raw/qavanin-index/qavanin-list.tsv.gz`؛ یا با ابزار برداشت:
   ```bash
   pip install -r scripts/scraper/requirements.txt && playwright install chromium
   python scripts/scraper/qavanin_playwright.py search "قانون تجارت الکترونیکی"
   ```
   برای ۲۹ مورد «در انتظار» کاتالوگ، شناسه از پیش در `source.qavaninId` ثبت و با فهرست عناوین تطبیق داده شده است.
2. **دریافت متن** (رعایت robots.txt و حداقل ۸ ثانیه فاصله بین درخواست‌ها):
   ```bash
   python scripts/scraper/qavanin_playwright.py fetch 86054 --slug electronic-commerce
   python scripts/scraper/qavanin_playwright.py catalog                  # همه موارد در انتظار دارای qavaninId
   python scripts/scraper/qavanin_playwright.py catalog --only vat,labor  # فقط موارد مشخص
   ```
   خروجی: `data/raw/qavanin-text/electronic-commerce.txt` + `.meta.json` (آدرس، زمان، SHA-256) و HTML خام برای ممیزی در `scripts/scraper/output/html/`.
3. **کاتالوگ**: در `data/catalog.json` منبع را از `{"kind": "pending"}` به
   `{"kind": "qavanin-text", "file": "electronic-commerce.txt", "qavaninId": <IDS>}` تغییر دهید و در صورت نیاز `upstream` جدید (مثلاً `"qavanin-live"` با `snapshotDate` امروز) تعریف کنید.
4. **ساخت و بازبینی**: `npm run data:laws` ← بررسی `data/qa-report.md` و نمونه‌برداری دستی از مواد در برابر روزنامه رسمی.
5. **انتشار**: `npm run data -- --release` (نسخه خودکار: افزودن قانون = minor) ← commit.

### اصول اخلاقی برداشت

- فقط صفحات عمومی؛ بررسی robots.txt پیش از هر درخواست؛ احترام به `Crawl-delay` و `Retry-After`.
- نرخ پایین (یک صفحه در ≥۸ ثانیه)، یک مرورگر، کش محلی برای جلوگیری از درخواست تکراری.
- User-Agent شفاف با آدرس پروژه.
- متن‌ها بدون تغییر محتوایی ذخیره و منشأ هر فایل ثبت می‌شود.

## فهرست عناوین مصوبات (qavanin-index)

| مرحله | ابزار | خروجی |
|---|---|---|
| ورود از خزنده متن‌باز یا ابزار برداشت | `scripts/pipeline/import_qavanin_list.py --xlsx …` / `--tsv … --merge` | `data/raw/qavanin-index/qavanin-list.tsv.gz` (عیناً مطابق منبع؛ فقط TAB/خط‌جدید ← فاصله) |
| تطبیق شناسه‌های کاتالوگ | `build_laws.py` (`check_qavanin_ids`) | هشدار در `data/qa-report.md` اگر عنوان یا تاریخ تصویب شناسه با کاتالوگ نخواند |
| بسته‌بندی | `scripts/lib/qindex-build.ts` (در `npm run data`) | `public/data/qindex/manifest.json` + ۵۷ بسته ستونی؛ خلاصه در کاتالوگ |
| طبقه‌بندی | `classifyEntry` در `src/lib/qindex/model.ts` | قانون اساسی، قوانین، مقررات، شوراها، آرا، نظریات مشورتی، سایر — بر اساس مرجع تصویب |

جزئیات منشأ و محدودیت‌ها: [`data/raw/qavanin-index/SOURCE.md`](../data/raw/qavanin-index/SOURCE.md).

## فایل‌های مهم

| مسیر | توضیح |
|---|---|
| `data/catalog.json` | فهرست قوانین: عنوان، نام‌های مستعار (برای جستجوی شماره ماده)، سلسله‌مراتب، دسته و زیرموضوع، نوع سند، منبع و `qavaninId` |
| `data/raw/qavanin-index/qavanin-list.tsv.gz` | فهرست عناوین ۱۵۰٬۴۳۷ مصوبه سامانه ملی قوانین |
| `data/glossary.json` | مفاهیم حقوقی: `match` (برچسب‌گذاری دقیق) و `expand` (هم‌معناهای عامیانه برای جستجوی مفهومی) |
| `data/version.json` | نسخه فعلی داده (semver) |
| `data/releases/<v>.json` | اثرانگشت هش مواد هر انتشار (برای ساخت patch) |
| `data/patches/<from>_<to>.json` | JSON Patch میان دو نسخه |

</div>
