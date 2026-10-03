#!/usr/bin/env python3
"""
پایش هفتگی روزنامه رسمی (rrk.ir) برای یافتن قوانین/اصلاحیه‌های تازه — هسته «پنل ادمین» آینده

- فهرست تازه‌ترین مصوبات را مؤدبانه (robots.txt + محدودیت نرخ) دریافت می‌کند
- عنوان‌ها را با کاتالوگ مقایسه می‌کند و مواردی که به قوانین موجود مربوط‌اند («اصلاح»، «الحاق»، نام قانون) علامت می‌زند
- گزارش Markdown/JSON تولید می‌کند تا نگه‌دارنده تصمیم بگیرد کدام قانون دوباره برداشت شود

نمونه:
  python scripts/admin/rrk_watch.py --url "https://rrk.ir/Laws/" --out scripts/admin/output/rrk-report.md
  # در GitHub Actions (هفتگی): .github/workflows/weekly-watch.yml

توجه: ساختار HTML سایت ممکن است تغییر کند؛ انتخابگرها با --item-selector قابل تنظیم‌اند.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "scraper"))
sys.path.insert(0, str(ROOT / "scripts" / "pipeline"))

from normalize_fa import normalize_search  # noqa: E402
from polite import PoliteSession  # noqa: E402

STATE = Path(__file__).resolve().parent / ".state" / "rrk-seen.json"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="https://rrk.ir/Laws/")
    ap.add_argument("--item-selector", default="a[href*='ShowLaw'], a[href*='/Laws/'], table a")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "output" / "rrk-report.md"))
    args = ap.parse_args()

    from bs4 import BeautifulSoup

    session = PoliteSession(min_interval=6.0, use_cache=False)
    html = session.get_text(args.url)
    soup = BeautifulSoup(html, "html.parser")
    items = []
    for a in soup.select(args.item_selector):
        title = " ".join(a.get_text(" ", strip=True).split())
        href = a.get("href") or ""
        if len(title) < 12 or not re.search(r"(قانون|آیین|آئین|تصویب|لایحه|اصلاح)", title):
            continue
        items.append({"title": title, "url": requests_join(args.url, href)})

    catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    names = [(e["id"], normalize_search(n)) for e in catalog["laws"] for n in [e["title"], e.get("shortTitle", "")] + e.get("aliases", []) if len(n) > 4]
    seen = set(json.loads(STATE.read_text(encoding="utf-8"))) if STATE.exists() else set()
    fresh = []
    for it in items:
        if it["url"] in seen:
            continue
        nt = normalize_search(it["title"])
        it["relatedLaws"] = sorted({lid for lid, n in names if n and n in nt})
        it["isAmendment"] = bool(re.search(r"(اصلاح|الحاق|تمدید|استفساریه|نسخ)", it["title"]))
        fresh.append(it)
        seen.add(it["url"])

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"# گزارش پایش روزنامه رسمی — {now}", "", f"منبع: {args.url}", "", f"موارد تازه: {len(fresh)}", ""]
    for it in fresh:
        flag = "🔴 مرتبط با قوانین موجود" if it["relatedLaws"] else ("🟠 اصلاحیه" if it["isAmendment"] else "⚪")
        lines.append(f"- {flag} [{it['title']}]({it['url']})" + (f" — {', '.join(it['relatedLaws'])}" if it["relatedLaws"] else ""))
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    out.with_suffix(".json").write_text(json.dumps(fresh, ensure_ascii=False, indent=1), encoding="utf-8")
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(sorted(seen), ensure_ascii=False), encoding="utf-8")
    print(f"✓ {len(fresh)} مورد تازه → {out}")


def requests_join(base: str, href: str) -> str:
    from urllib.parse import urljoin

    return urljoin(base, href)


if __name__ == "__main__":
    main()
