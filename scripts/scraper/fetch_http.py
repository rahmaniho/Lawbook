#!/usr/bin/env python3
"""
دریافت متن قانون از صفحات ایستا (بدون چالش جاوااسکریپت) با BeautifulSoup — مثلاً rc.majlis.ir
و تبدیل آن به قالب qavanin-text.

نمونه:
  python scripts/scraper/fetch_http.py "https://rc.majlis.ir/fa/law/show/XXXXX" \
      --selector "div.law-text" --title "قانون تجارت الکترونیکی" --approval "مصوب 1382/10/17 مجلس شورای اسلامی" \
      --slug electronic-commerce

همه درخواست‌ها از PoliteSession عبور می‌کنند (robots.txt، محدودیت نرخ، کش).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bs4 import BeautifulSoup  # noqa: E402

from extract import plain_text_to_qavanin_text  # noqa: E402
from polite import PoliteSession  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url")
    ap.add_argument("--selector", default="article, main, body", help="انتخابگر CSS ظرف متن قانون")
    ap.add_argument("--title", required=True)
    ap.add_argument("--approval", default="", help="سطر «مصوب YYYY/MM/DD مرجع»")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--interval", type=float, default=6.0)
    args = ap.parse_args()

    session = PoliteSession(min_interval=args.interval)
    html = session.get_text(args.url)
    soup = BeautifulSoup(html, "html.parser")
    box = soup.select_one(args.selector) or soup
    for t in box.select("script, style, nav, header, footer"):
        t.decompose()
    lines = [l for l in box.get_text("\n").split("\n")]
    text = plain_text_to_qavanin_text(lines, title=args.title, approval=args.approval)
    out = ROOT / "data" / "raw" / "qavanin-text" / f"{args.slug}.txt"
    out.write_text(text, encoding="utf-8")
    meta = {
        "url": args.url,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(text.encode()).hexdigest(),
        "tool": "scripts/scraper/fetch_http.py",
    }
    out.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"✓ {out.relative_to(ROOT)} — لطفاً پیش از انتشار، متن را با منبع رسمی تطبیق دهید.")


if __name__ == "__main__":
    main()
