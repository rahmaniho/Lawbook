# منشأ داده‌ها (Provenance)

> این فایل به‌صورت خودکار با `python3 scripts/pipeline/gen_docs.py` تولید می‌شود.

متن همه قوانین موجود، «متن تلفیقی با اصلاحات» **سامانه ملی قوانین و مقررات جمهوری اسلامی ایران (qavanin.ir)** است.
از آنجا که محیط ساخت این پروژه به سایت‌های ایرانی دسترسی نداشت، متن‌ها از یک برداشت بایگانی‌شده و متن‌باز با همان قالب سامانه گرفته شده‌اند:

- **مخزن:** [HamedJahantigh-git/legal_chatbot](https://github.com/HamedJahantigh-git/legal_chatbot) — مجوز **MIT** (متن مجوز: `data/raw/qavanin-text/LICENSE.upstream.txt`)
- **کامیت:** `c4d0f410a31d202b6fed6e56ddb18ab02aa343f3` — مسیر `resource/sample_resource/law_file`
- **تاریخ برداشت/بایگانی:** 2024-05-04
- **منشأ اصلی:** سامانه ملی قوانین و مقررات جمهوری اسلامی ایران (qavanin.ir)

| شناسه | قانون | فایل خام | فایل اصلی | بخش (segment) | SHA-256 فایل خام |
|---|---|---|---|---|---|
| `constitution` | قانون اساسی جمهوری اسلامی ایران | `data/raw/qavanin-text/constitution.txt` | `q0.txt` | — | `887a89004f2fbd51…` |
| `civil-code` | قانون مدنی | `data/raw/qavanin-text/civil-code.txt` | `q3.txt` | — | `ef502342d6ede5f7…` |
| `penal-code` | قانون مجازات اسلامی | `data/raw/qavanin-text/penal-code.txt` | `q2.txt` | — | `abad038b1f5fb3ca…` |
| `penal-code-tazirat` | قانون مجازات اسلامی (کتاب پنجم - تعزیرات و مجازات‌های بازدارنده) | `data/raw/qavanin-text/penal-code.txt` | `q2.txt` | از «کتاب پنجم - تعزیرات» تا انتها | `abad038b1f5fb3ca…` |
| `criminal-procedure` | قانون آیین دادرسی کیفری | `data/raw/qavanin-text/criminal-procedure.txt` | `q1.txt` | — | `fc89dec0b9aa94b5…` |
| `civil-procedure` | قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی | `data/raw/qavanin-text/civil-procedure.txt` | `q5.txt` | — | `2f60f6accfe42014…` |
| `family-protection` | قانون حمایت خانواده | `data/raw/qavanin-text/family-protection.txt` | `q8.txt` | — | `bdb01db7e12ae129…` |
| `commercial-code` | قانون تجارت | `data/raw/qavanin-text/commercial-code.txt` | `q15.txt` | — | `f4bad8a8d8d1308f…` |
| `commercial-code-amendment-1347` | لایحه قانونی اصلاح قسمتی از قانون تجارت | `data/raw/qavanin-text/commercial-code.txt` | `q15.txt` | از «لایحه قانونی اصلاح قسمتی از قانون تجارت» تا «مبحث دوم - شرکت با مسئولیت محدود» | `f4bad8a8d8d1308f…` |
| `cheque` | قانون صدور چک | `data/raw/qavanin-text/cheque.txt` | `q14.txt` | — | `78714642b9e99c91…` |
| `labor` | قانون کار جمهوری اسلامی ایران | `data/raw/qavanin-text/labor.txt` | `q16.txt` | — | `cf2bb2d73c5c6e54…` |
| `administrative-court` | قانون تشکیلات و آیین دادرسی دیوان عدالت اداری | `data/raw/qavanin-text/administrative-court.txt` | `q13.txt` | — | `ff4d802112680890…` |
| `direct-taxes` | قانون مالیات‌های مستقیم | `data/raw/qavanin-text/direct-taxes.txt` | `q10.txt` | — | `94c3a1098c2efbec…` |
| `civil-liability` | قانون مسئولیت مدنی | `data/raw/qavanin-text/civil-liability.txt` | `q4.txt` | — | `2bf003f29d790ca3…` |
| `registration` | قانون ثبت اسناد و املاک | `data/raw/qavanin-text/registration.txt` | `q11.txt` | — | `5a623d428e8a8bad…` |
| `civil-judgments-enforcement` | قانون اجرای احکام مدنی | `data/raw/qavanin-text/civil-judgments-enforcement.txt` | `q6.txt` | — | `5f690a1378beea19…` |
| `financial-convictions` | قانون نحوه اجرای محکومیت‌های مالی | `data/raw/qavanin-text/financial-convictions.txt` | `q7.txt` | — | `2f129d9bff651eb4…` |
| `dispute-councils` | قانون شوراهای حل اختلاف | `data/raw/qavanin-text/dispute-councils.txt` | `q17.txt` | — | `e8a1d1b8f388831d…` |
| `third-party-insurance` | قانون بیمه اجباری خسارات واردشده به شخص ثالث در اثر حوادث ناشی از وسایل نقلیه | `data/raw/qavanin-text/third-party-insurance.txt` | `q18.txt` | — | `2a890e46e2c979b8…` |
| `municipality` | قانون شهرداری | `data/raw/qavanin-text/municipality.txt` | `q9.txt` | — | `0fa7f7733e6ee827…` |

## تغییرات اعمال‌شده روی متن

فقط نرمال‌سازی نگارشی (بدون تغییر محتوا): تبدیل «ي/ك» عربی به «ی/ک»، حذف کشیده و نویسه‌های کنترلی جهت‌نما،
اصلاح نیم‌فاصله‌های اضافه (مثلاً «نهضت‌ های» ← «نهضت‌های»)، و تبدیل ارقام فارسی/عربی به لاتین در داده (نمایش فارسی در رابط کاربری).
قواعد دقیق: `scripts/pipeline/normalize_fa.py` (و معادل TypeScript در `src/lib/normalize.ts`).

نشانگرهای ویراستاری سامانه مانند «(اصلاحی 1370/8/14)» و «[تبصره … الحاق شده است]» عیناً حفظ و در رابط کاربری متمایز نمایش داده می‌شوند.
