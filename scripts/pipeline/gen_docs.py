#!/usr/bin/env python3
"""
تولید خودکار مستندات داده از کاتالوگ و داده‌های ساخته‌شده:
  data/SOURCES.md     منشأ هر فایل خام (مخزن، کامیت، مجوز، تاریخ برداشت، هش)
  docs/COVERAGE.md    وضعیت پوشش قوانین (موجود / در انتظار) + چک‌لیست قوانین اصلی

اجرا: python3 scripts/pipeline/gen_docs.py   (پس از build_laws.py)
"""

from __future__ import annotations

import gzip
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
QINDEX = ROOT / "data" / "raw" / "qavanin-index" / "qavanin-list.tsv.gz"
QURL = "https://qavanin.ir/Law/TreeText/{id}"


def qindex_stats() -> dict | None:
    """خلاصه فهرست عناوین سامانه (تعداد، بازه و توزیع مراجع) برای مستندات."""
    if not QINDEX.exists():
        return None
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from normalize_fa import normalize_display  # noqa: PLC0415

    rows = 0
    latest = ""
    authorities: Counter = Counter()
    decades: Counter = Counter()
    with gzip.open(QINDEX, "rt", encoding="utf-8") as f:
        next(f)
        for line in f:
            parts = line.rstrip("\n").split("\t")
            rows += 1
            date = parts[2] if len(parts) > 2 else ""
            if len(date) == 10 and date[:4].isdigit() and 1280 <= int(date[:4]) <= 1500:
                latest = max(latest, date)
                decades[int(date[:3]) * 10] += 1
            authorities[normalize_display(parts[3]) if len(parts) > 3 else ""] += 1
    return {"rows": rows, "latest": latest, "authorities": authorities, "decades": decades}


def fa(x) -> str:
    return str(x).translate(FA)


CHECKLIST = [
    ("قانون اساسی (۱۷۷ اصل)", ["constitution"]),
    ("قانون مدنی (کتاب‌های ۱ تا ۱۰)", ["civil-code"]),
    ("قانون مجازات اسلامی ۱۳۹۲ (حدود، قصاص، دیات، تعزیرات)", ["penal-code", "penal-code-tazirat"]),
    ("قانون آیین دادرسی کیفری", ["criminal-procedure"]),
    ("قانون آیین دادرسی مدنی (۵۲۹ ماده + ۷۲ تبصره)", ["civil-procedure"]),
    ("قانون تجارت + لایحه اصلاحی", ["commercial-code", "commercial-code-amendment-1347"]),
    ("قانون تجارت الکترونیکی (۸۱ ماده)", ["electronic-commerce"]),
    ("قانون حمایت خانواده ۱۳۹۱ + آیین‌نامه", ["family-protection", "family-protection-regulation"]),
    ("قانون کار ۱۳۶۹ (۲۰۳ ماده)", ["labor"]),
    ("قانون دیوان عدالت اداری ۱۳۹۲", ["administrative-court"]),
    ("قوانین مالیات مستقیم و ارزش افزوده", ["direct-taxes", "vat"]),
    ("قوانین برنامه‌های توسعه ۱ تا ۷", ["development-plans"]),
    ("قوانین شهرداری‌ها، محیط زیست و مالکیت فکری", ["municipality", "environment-protection", "copyright", "industrial-property"]),
    ("آرای وحدت رویه دیوان عالی", ["supreme-court-precedents"]),
    ("نظریات مشورتی اداره حقوقی", ["advisory-opinions"]),
]


def main() -> int:
    catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    laws = {}
    for p in (ROOT / "data" / "laws").glob("*.json"):
        if p.name != "index.json":
            law = json.loads(p.read_text(encoding="utf-8"))
            laws[law["id"]] = law
    version = json.loads((ROOT / "data" / "version.json").read_text(encoding="utf-8"))["version"]
    cats = {c["id"]: c["title"] for c in catalog["categories"]}
    hier = {h["id"]: h["title"] for h in catalog["hierarchy"]}

    # ---- SOURCES.md
    s = [
        "# منشأ داده‌ها (Provenance)",
        "",
        "> این فایل به‌صورت خودکار با `python3 scripts/pipeline/gen_docs.py` تولید می‌شود.",
        "",
        "متن همه قوانین موجود، «متن تلفیقی با اصلاحات» **سامانه ملی قوانین و مقررات جمهوری اسلامی ایران (qavanin.ir)** است.",
        "از آنجا که محیط ساخت این پروژه به سایت‌های ایرانی دسترسی نداشت، متن‌ها از یک برداشت بایگانی‌شده و متن‌باز با همان قالب سامانه گرفته شده‌اند:",
        "",
    ]
    for key, up in catalog["upstreams"].items():
        s += [
            f"- **مخزن:** [{up['name']}]({up['repo']}) — مجوز **{up['license']}** (متن مجوز: `{up['licenseFile']}`)",
            f"- **کامیت:** `{up['commit']}` — مسیر `{up['path']}`",
            f"- **تاریخ برداشت/بایگانی:** {up['snapshotDate']}",
            f"- **منشأ اصلی:** {up['origin']}",
            "",
        ]
    s += ["| شناسه | قانون | فایل خام | فایل اصلی | بخش (segment) | SHA-256 فایل خام |", "|---|---|---|---|---|---|"]
    for e in catalog["laws"]:
        law = laws.get(e["id"])
        if not law:
            continue
        src = law["source"]
        seg = e["source"].get("segment")
        seg_txt = f"از «{seg['start']}»" + (f" تا «{seg['end']}»" if seg.get("end") else " تا انتها") if seg else "—"
        s.append(
            f"| `{e['id']}` | {law['title']} | `{src['rawFile']}` | `{e['source'].get('originalFile', '')}` | {seg_txt} | `{src['rawSha256'][:16]}…` |"
        )
    s += [
        "",
        "## تغییرات اعمال‌شده روی متن",
        "",
        "فقط نرمال‌سازی نگارشی (بدون تغییر محتوا): تبدیل «ي/ك» عربی به «ی/ک»، حذف کشیده و نویسه‌های کنترلی جهت‌نما،",
        "اصلاح نیم‌فاصله‌های اضافه (مثلاً «نهضت‌ های» ← «نهضت‌های»)، و تبدیل ارقام فارسی/عربی به لاتین در داده (نمایش فارسی در رابط کاربری).",
        "قواعد دقیق: `scripts/pipeline/normalize_fa.py` (و معادل TypeScript در `src/lib/normalize.ts`).",
        "",
        "نشانگرهای ویراستاری سامانه مانند «(اصلاحی 1370/8/14)» و «[تبصره … الحاق شده است]» عیناً حفظ و در رابط کاربری متمایز نمایش داده می‌شوند.",
        "",
    ]

    s += [
        "## فهرست عناوین مصوبات سامانه ملی قوانین",
        "",
        "`data/raw/qavanin-index/qavanin-list.tsv.gz` — عنوان، تاریخ و مرجع تصویب همه مصوبات ثبت‌شده در سامانه (۱۲۸۵ به بعد)، برداشت‌شده با",
        "خزنده متن‌باز abdal و بایگانی‌شده در مخزن [fatemeq/standard](https://github.com/fatemeq/standard) (کامیت `ade1c0ecb06ac7136f2cd41393f0e971c746615d`).",
        "جزئیات و محدودیت‌ها: [`data/raw/qavanin-index/SOURCE.md`](raw/qavanin-index/SOURCE.md).",
        "",
    ]
    (ROOT / "data" / "SOURCES.md").write_text("\n".join(s), encoding="utf-8")

    # ---- COVERAGE.md
    total = sum(l["stats"]["articles"] for l in laws.values())
    qs = qindex_stats()
    c = [
        "# پوشش قوانین",
        "",
        "> این فایل به‌صورت خودکار با `python3 scripts/pipeline/gen_docs.py` تولید می‌شود.",
        "",
        f"نسخه داده: **{version}** — **{len(laws)}** قانون با متن کامل، **{total}** ماده/اصل؛ "
        f"**{len(catalog['laws']) - len(laws)}** مورد دیگر در فهرست «در انتظار ورود متن» است.",
        "",
        "> «پیوند رسمی» = نشانی متن همان مصوبه در سامانه ملی قوانین (`https://qavanin.ir/Law/TreeText/{شناسه}`) که در اپ برای همه موارد",
        "> (حتی موارد در انتظار ورود متن) نمایش داده می‌شود و با فهرست عناوین سامانه تطبیق داده شده است.",
        "",
        "## چک‌لیست قوانین اصلی",
        "",
        "| مورد | وضعیت | جزئیات |",
        "|---|---|---|",
    ]
    entries = {e["id"]: e for e in catalog["laws"]}

    def index_count(e: dict) -> int:
        """تعداد عناوین مرتبط در فهرست مصوبات (برای مجموعه‌هایی مانند آرای وحدت رویه)"""
        if not qs or not e.get("qindex"):
            return 0
        a = e["qindex"].get("authority")
        if a:
            return sum(n for name, n in qs["authorities"].items() if name == a)
        if e["qindex"]["type"] == "advisory":
            return sum(n for name, n in qs["authorities"].items() if "اداره کل حقوقی" in name)
        return 0

    for title, ids in CHECKLIST:
        have = [i for i in ids if i in laws]
        status = "✅ کامل" if len(have) == len(ids) else ("🟡 بخشی" if have else "⏳ در انتظار")
        parts = []
        for i in ids:
            if i in laws:
                parts.append(f"{laws[i]['shortTitle']} ({laws[i]['stats']['articles']} {laws[i]['unit']})")
                continue
            e = entries.get(i, {"shortTitle": i})
            extra = []
            if (e.get("source") or {}).get("qavaninId"):
                extra.append(f"[پیوند رسمی]({QURL.format(id=e['source']['qavaninId'])})")
            if e.get("members"):
                linked = sum(1 for m in e["members"] if m.get("qavaninId"))
                extra.append(f"{linked} پیوند رسمی از {len(e['members'])} قانون")
            n = index_count(e)
            if n:
                extra.append(f"{n:,} عنوان در فهرست مصوبات")
            parts.append(f"{e['shortTitle']} — متن در انتظار" + (f" ({'؛ '.join(extra)})" if extra else ""))
        c.append(f"| {title} | {status} | {'، '.join(parts)} |")
    c += [
        "",
        "## قوانین دارای متن کامل",
        "",
        "| قانون | سلسله‌مراتب | دسته | تصویب | مواد | تبصره | اصلاحی | منسوخ | آخرین به‌روزرسانی متن |",
        "|---|---|---|---|---:|---:|---:|---:|---|",
    ]
    for e in catalog["laws"]:
        law = laws.get(e["id"])
        if not law:
            continue
        st = law["stats"]
        c.append(
            f"| {law['title']} | {hier[law['hierarchy']]} | {cats[law['category']]} | {law['approval'].get('date', '—')} | {st['articles']} | {st['notes']} | {st['amended']} | {st['repealed']} | {law['lastUpdated']} |"
        )
    c += [
        "",
        "## در انتظار ورود متن",
        "",
        "این موارد در فهرست اپ با برچسب «در انتظار ورود متن» و پیوند به منابع رسمی نمایش داده می‌شوند. برای افزودن هر کدام، مراحل",
        "[DATA_PIPELINE.md](DATA_PIPELINE.md#افزودن-قانون-جدید) را دنبال کنید (یافتن شناسه با `qavanin_playwright.py search`، دریافت، ساخت، کنترل کیفیت، انتشار).",
        "",
        "| شناسه | عنوان | تصویب | سلسله‌مراتب | دسته | پیوند رسمی |",
        "|---|---|---|---|---|---|",
    ]
    for e in catalog["laws"]:
        if e["id"] in laws:
            continue
        kind = " (توضیحی)" if e.get("kind") == "info" else (" (مجموعه)" if e.get("kind") == "collection" else "")
        q = (e.get("source") or {}).get("qavaninId")
        link = f"[{q}]({QURL.format(id=q)})" if q else ("فهرست مصوبات" if e.get("qindex") else "—")
        if e.get("seeAlso"):
            link += f" — متن در `{e['seeAlso']['lawId']}` از ماده {e['seeAlso']['key']}"
        c.append(f"| `{e['id']}` | {e['title']}{kind} | {(e.get('approval') or {}).get('date', '—')} | {hier[e['hierarchy']]} | {cats[e['category']]} | {link} |")
        for m in e.get("members", []):
            ml = f"[{m['qavaninId']}]({QURL.format(id=m['qavaninId'])})" if m.get("qavaninId") else (m.get("note") or "—")
            c.append(f"| ↳ | {m['title']} | {m.get('date', '—')} | | | {ml} |")

    c += [
        "",
        "## دسته‌بندی موضوعی (حداقل الزامی مشخصات)",
        "",
        "| دسته | زیرموضوع | موارد |",
        "|---|---|---|",
    ]
    by_id = {e["id"]: e for e in catalog["laws"]}
    for cat in catalog["categories"]:
        for st in cat.get("subtopics", []):
            items = []
            for lid in st["laws"]:
                e = by_id[lid]
                mark = "✅" if lid in laws else ("📎" if e.get("seeAlso") else "⏳")
                items.append(f"{mark} {e.get('shortTitle', e['title'])}")
            c.append(f"| {cat['title']} | {st['title']} | {'، '.join(items)} |")
    c += ["", "✅ متن کامل در اپ · 📎 متن در قانون دیگرِ موجود · ⏳ در انتظار ورود متن (با پیوند رسمی)", ""]

    if qs:
        c += [
            "## فهرست همه مصوبات سامانه ملی قوانین (۱۲۸۵ تاکنون)",
            "",
            f"اپ عنوان، تاریخ و مرجع تصویب **{qs['rows']:,}** مصوبه سامانه ملی قوانین (تا **{qs['latest']}**) را در صفحه «فهرست مصوبات» "
            "(`/enactments`) قابل جستجو و مرور می‌کند و برای هر مورد پیوند متن رسمی را نمایش می‌دهد. این فهرست شامل متن مصوبات نیست.",
            "",
            "| دهه | تعداد مصوبه |",
            "|---|---:|",
        ]
        for dec in sorted(qs["decades"]):
            c.append(f"| {dec}–{dec + 9} | {qs['decades'][dec]:,} |")
        c += ["", "| مرجع تصویب (۱۵ مرجع پرتکرار) | تعداد |", "|---|---:|"]
        for name, n in qs["authorities"].most_common(15):
            c.append(f"| {name or '—'} | {n:,} |")
        c += [
            "",
            "مصوبات پس از تاریخ آخرین مصوبه فهرست با فرمان `list` ابزار برداشت (`scripts/scraper/qavanin_playwright.py list`) از شبکه داخل ایران",
            "افزوده می‌شوند؛ راهنما: [UPDATING.md](UPDATING.md#به‌روزرسانی-فهرست-مصوبات).",
            "",
        ]
    c += [
        "",
        "## یادداشت‌های کنترل کیفیت",
        "",
        "- قانون اساسی پس از بازنگری ۱۳۶۸ دارای **۱۴ فصل** و ۱۷۷ اصل است (نه ۱۲ فصل).",
        "- «قانون مجازات اسلامی» در سامانه شامل کتاب پنجم (تعزیرات ۱۳۷۵ و فصل جرائم رایانه‌ای) است؛ در اپ به دو قانون جدا تقسیم شده تا شماره مواد تکراری نشود.",
        "- «قانون تجارت» در سامانه، لایحه اصلاحی ۱۳۴۷ (شرکت‌های سهامی، ۳۰۰ ماده) را در جای مواد ۲۱ تا ۹۴ درج کرده است؛ در اپ قانون مستقل است.",
        "- «قانون آیین دادرسی کیفری» شامل بخش‌های الحاقی هشتم تا دوازدهم (مواد ۵۷۱ تا ۶۹۹) است.",
        "- گزارش کامل کنترل کیفیت هر ساخت: [`data/qa-report.md`](../data/qa-report.md).",
        "",
    ]
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "COVERAGE.md").write_text("\n".join(c), encoding="utf-8")

    # ---- LEGAL_REVIEW.md (چک‌لیست نظارت حقوقی)
    r = [
        '<div dir="rtl">',
        "",
        "# چک‌لیست بازبینی و نظارت حقوقی",
        "",
        "> این فایل به‌صورت خودکار با `python3 scripts/pipeline/gen_docs.py` تولید می‌شود.",
        "",
        "جمع‌آوری و تدوین اطلاعات این پروژه زیر نظر **وکیل پایه یک دادگستری لیلا آبکه** انجام می‌شود. پیش از هر انتشار داده، موارد زیر",
        "برای هر قانون بازبینی و نتیجه در توضیحات Pull Request ثبت شود. تا پیش از تأیید نهایی، وضعیت تطبیق هر قانون در اپ",
        "«برگرفته از سامانه ملی قوانین — تطبیق نهایی با روزنامه رسمی توصیه می‌شود» نمایش داده می‌شود.",
        "",
        "## موارد بازبینی برای هر قانون",
        "",
        "1. تطبیق تعداد مواد، تبصره‌ها و عناوین (باب/فصل/مبحث) با متن رسمی (پیوند سامانه ملی قوانین / روزنامه رسمی).",
        "2. بررسی اصلاحات و الحاقات پس از تاریخ برداشت متن (ستون «تاریخ متن») و ثبت موارد جاافتاده برای برداشت مجدد.",
        "3. نمونه‌خوانی دست‌کم ۲۰ ماده تصادفی (شامل مواد اصلاحی و منسوخ) در برابر متن رسمی؛ هیچ اختلاف واژه‌ای پذیرفته نیست.",
        "4. درستی برچسب وضعیت (لازم‌الاجرا / اصلاحی / منسوخ) و نشانگرهای ویراستاری سامانه.",
        "5. درستی محاسبه‌گرها (ارث و دیه) و استنادهای آن‌ها به مواد قانون، و نرخ دیه سال جاری.",
        "",
        "## قوانین دارای متن کامل",
        "",
        "| قانون | مواد | تاریخ متن | پیوند رسمی | ۱ | ۲ | ۳ | ۴ |",
        "|---|---:|---|---|:-:|:-:|:-:|:-:|",
    ]
    for e in catalog["laws"]:
        law = laws.get(e["id"])
        if not law:
            continue
        q = law["source"].get("qavaninId")
        link = f"[{q}]({QURL.format(id=q)})" if q else "—"
        r.append(f"| {law['title']} | {law['stats']['articles']} | {law['lastUpdated']} | {link} | ☐ | ☐ | ☐ | ☐ |")
    r += [
        "",
        "## پس از تأیید",
        "",
        "برای قانونی که همه موارد آن تأیید شد، در کاتالوگ مقدار `\"verification\": \"verified\"` را در منبع ثبت و نسخه داده را منتشر کنید؛",
        "اپ وضعیت را «تطبیق‌شده با روزنامه رسمی» نمایش می‌دهد. متن‌ها هرگز به‌صورت دستی ویرایش نمی‌شوند؛ اصلاح فقط با برداشت مجدد از منبع رسمی.",
        "",
        "</div>",
        "",
    ]
    (ROOT / "docs" / "LEGAL_REVIEW.md").write_text("\n".join(r), encoding="utf-8")
    print("✓ data/SOURCES.md، docs/COVERAGE.md و docs/LEGAL_REVIEW.md به‌روز شد")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
