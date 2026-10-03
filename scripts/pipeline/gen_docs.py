#!/usr/bin/env python3
"""
تولید خودکار مستندات داده از کاتالوگ و داده‌های ساخته‌شده:
  data/SOURCES.md     منشأ هر فایل خام (مخزن، کامیت، مجوز، تاریخ برداشت، هش)
  docs/COVERAGE.md    وضعیت پوشش قوانین (موجود / در انتظار) + چک‌لیست قوانین اصلی

اجرا: python3 scripts/pipeline/gen_docs.py   (پس از build_laws.py)
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


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
    (ROOT / "data" / "SOURCES.md").write_text("\n".join(s), encoding="utf-8")

    # ---- COVERAGE.md
    total = sum(l["stats"]["articles"] for l in laws.values())
    c = [
        "# پوشش قوانین",
        "",
        "> این فایل به‌صورت خودکار با `python3 scripts/pipeline/gen_docs.py` تولید می‌شود.",
        "",
        f"نسخه داده: **{version}** — **{len(laws)}** قانون با متن کامل، **{total}** ماده/اصل؛ "
        f"**{len(catalog['laws']) - len(laws)}** مورد دیگر در فهرست «در انتظار ورود متن» است.",
        "",
        "## چک‌لیست قوانین اصلی",
        "",
        "| مورد | وضعیت | جزئیات |",
        "|---|---|---|",
    ]
    for title, ids in CHECKLIST:
        have = [i for i in ids if i in laws]
        status = "✅ کامل" if len(have) == len(ids) else ("🟡 بخشی" if have else "⏳ در انتظار")
        det = "، ".join(
            (f"{laws[i]['shortTitle']} ({laws[i]['stats']['articles']} {laws[i]['unit']})" if i in laws else f"{next((e['shortTitle'] for e in catalog['laws'] if e['id'] == i), i)} — در انتظار")
            for i in ids
        )
        c.append(f"| {title} | {status} | {det} |")
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
        "| شناسه | عنوان | سلسله‌مراتب | دسته |",
        "|---|---|---|---|",
    ]
    for e in catalog["laws"]:
        if e["id"] in laws:
            continue
        kind = " (توضیحی)" if e.get("kind") == "info" else (" (مجموعه)" if e.get("kind") == "collection" else "")
        c.append(f"| `{e['id']}` | {e['title']}{kind} | {hier[e['hierarchy']]} | {cats[e['category']]} |")
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
    print("✓ data/SOURCES.md و docs/COVERAGE.md به‌روز شد")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
