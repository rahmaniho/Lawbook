#!/usr/bin/env python3
"""
برداشت متن تلفیقی قوانین از سامانه ملی قوانین و مقررات (qavanin.ir) با Playwright

چرا Playwright؟ سامانه API عمومی ندارد و پشت چالش جاوااسکریپتی (ArvanCloud) است؛ مرورگر واقعی
چالش را حل می‌کند. سرعت عمداً پایین نگه داشته می‌شود (یک صفحه هر ≥۸ ثانیه) و robots.txt رعایت می‌شود.

نصب:
  python3 -m venv .venv && . .venv/bin/activate
  pip install -r scripts/scraper/requirements.txt
  playwright install chromium

نمونه‌ها:
  # یافتن شناسه (IDS) قانون از روی عنوان
  python scripts/scraper/qavanin_playwright.py search "قانون تجارت الکترونیکی"

  # دریافت یک قانون با شناسه و ذخیره در data/raw/qavanin-text/electronic-commerce.txt
  python scripts/scraper/qavanin_playwright.py fetch 93250 --slug electronic-commerce

  # دریافت همه قوانینی که در data/catalog.json فیلد source.qavaninId دارند
  python scripts/scraper/qavanin_playwright.py catalog

پس از دریافت: در data/catalog.json منبع قانون را به {"kind": "qavanin-text", "file": "<slug>.txt"} تغییر دهید،
سپس `npm run data:laws` و بازبینی data/qa-report.md و در نهایت `npm run data -- --release`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract import html_to_qavanin_text  # noqa: E402
from polite import DEFAULT_UA  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "qavanin-text"
HTML_DIR = Path(__file__).resolve().parent / "output" / "html"
BASE = "https://qavanin.ir"
LAW_URL = BASE + "/Law/TreeText/?IDS={id}"
SEARCH_URL = (
    BASE
    + "/?CAPTION={q}&Zone=&IsTitleSearch=true&IsTitleSearch=false&IsTextSearch=false&_isLaw=true&_isLaw=false"
    + "&_isRegulation=false&_IsVote=false&_isOpenion=false&SeachTextType=3&SortColumn=APPROVEDATE&SortDesc=True"
    + "&PageNumber=1&page=1&size=50"
)


class Politeness:
    def __init__(self, min_interval: float = 8.0, jitter: float = 4.0):
        self.min_interval = min_interval
        self.jitter = jitter
        self.last = 0.0
        self.robots: urllib.robotparser.RobotFileParser | None = None

    def load_robots(self, context) -> None:
        rp = urllib.robotparser.RobotFileParser()
        try:
            resp = context.request.get(BASE + "/robots.txt", timeout=30000)
            rp.parse(resp.text().splitlines() if resp.ok else [])
        except Exception:
            rp.parse([])
        delay = rp.crawl_delay(DEFAULT_UA)
        if delay:
            self.min_interval = max(self.min_interval, float(delay))
        self.robots = rp

    def check(self, url: str) -> None:
        if self.robots and not self.robots.can_fetch(DEFAULT_UA, url):
            raise SystemExit(f"⛔ robots.txt اجازه دریافت نمی‌دهد: {url}")

    def wait(self) -> None:
        delta = self.last + self.min_interval + random.uniform(0, self.jitter) - time.monotonic()
        if delta > 0:
            time.sleep(delta)
        self.last = time.monotonic()


def open_browser(headless: bool = True):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("Playwright نصب نیست: pip install -r scripts/scraper/requirements.txt && playwright install chromium")
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=headless)
    context = browser.new_context(user_agent=DEFAULT_UA + " Playwright", locale="fa-IR")
    return pw, browser, context


def goto_with_retry(page, url: str, polite: Politeness, selector: str, retries: int = 3) -> str:
    polite.check(url)
    delay = 15.0
    for attempt in range(retries + 1):
        polite.wait()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=90000)
            # چالش ArvanCloud پس از اجرای جاوااسکریپت به صفحه اصلی هدایت می‌کند
            page.wait_for_selector(selector, timeout=90000)
            return page.content()
        except Exception as e:  # noqa: BLE001
            if attempt == retries:
                raise
            print(f"  … تلاش مجدد ({attempt + 1}) پس از {delay:.0f}s: {e}", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


def cmd_search(args) -> None:
    pw, browser, context = open_browser(not args.headed)
    polite = Politeness(args.interval)
    polite.load_robots(context)
    page = context.new_page()
    try:
        url = SEARCH_URL.format(q=urllib.parse.quote(args.query))
        html = goto_with_retry(page, url, polite, "table[class*='border']")
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        rows = []
        for a in soup.select("table[class*='border'] a[href*='IDS=']"):
            m = re.search(r"IDS=(\d+)", a.get("href", ""))
            if not m:
                continue
            tr = a.find_parent("tr")
            cells = [c.get_text(" ", strip=True) for c in tr.select("td")] if tr else []
            rows.append({"id": int(m.group(1)), "title": a.get_text(" ", strip=True), "row": cells})
        print(json.dumps(rows, ensure_ascii=False, indent=1))
    finally:
        browser.close()
        pw.stop()


def fetch_one(page, polite: Politeness, law_id: int, slug: str, unit: str = "ماده") -> Path:
    url = LAW_URL.format(id=law_id)
    print(f"→ {url}")
    html = goto_with_retry(page, url, polite, "div[id*='treeText'] p[class*='SecTex']")
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    (HTML_DIR / f"{law_id}.html").write_text(html, encoding="utf-8")
    text = html_to_qavanin_text(html, unit=unit)
    n_articles = len(re.findall(rf"^{unit} \d+", text, flags=re.M))
    if n_articles == 0:
        raise SystemExit(f"⚠ هیچ {unit}ی در صفحه {law_id} یافت نشد؛ HTML در {HTML_DIR} ذخیره شد تا بررسی شود.")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    out = RAW_DIR / f"{slug}.txt"
    out.write_text(text, encoding="utf-8")
    meta = {
        "qavaninId": law_id,
        "url": url,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(text.encode()).hexdigest(),
        "articles": n_articles,
        "tool": "scripts/scraper/qavanin_playwright.py",
    }
    out.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"  ✓ {out.relative_to(ROOT)} — {n_articles} {unit}")
    return out


def cmd_fetch(args) -> None:
    pw, browser, context = open_browser(not args.headed)
    polite = Politeness(args.interval)
    polite.load_robots(context)
    page = context.new_page()
    try:
        fetch_one(page, polite, args.id, args.slug, args.unit)
    finally:
        browser.close()
        pw.stop()


def cmd_catalog(args) -> None:
    catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    targets = [
        (e["source"]["qavaninId"], e["source"].get("file", f"{e['id']}.txt").removesuffix(".txt"), e.get("unit", "ماده"))
        for e in catalog["laws"]
        if e.get("source", {}).get("qavaninId")
    ]
    if not targets:
        print("هیچ قانونی با source.qavaninId در کاتالوگ نیست. ابتدا با دستور search شناسه را پیدا کنید.")
        return
    pw, browser, context = open_browser(not args.headed)
    polite = Politeness(args.interval)
    polite.load_robots(context)
    page = context.new_page()
    try:
        for law_id, slug, unit in targets:
            try:
                fetch_one(page, polite, law_id, slug, unit)
            except SystemExit as e:
                print(e, file=sys.stderr)
    finally:
        browser.close()
        pw.stop()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--interval", type=float, default=8.0, help="حداقل فاصله بین درخواست‌ها (ثانیه)")
    ap.add_argument("--headed", action="store_true", help="نمایش مرورگر (برای عیب‌یابی)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search", help="جستجوی عنوان و نمایش شناسه‌ها")
    s.add_argument("query")
    s.set_defaults(fn=cmd_search)
    f = sub.add_parser("fetch", help="دریافت یک قانون با شناسه IDS")
    f.add_argument("id", type=int)
    f.add_argument("--slug", required=True, help="نام فایل خروجی (بدون پسوند)، مثلاً electronic-commerce")
    f.add_argument("--unit", default="ماده", help="واحد شماره‌گذاری: ماده یا اصل")
    f.set_defaults(fn=cmd_fetch)
    c = sub.add_parser("catalog", help="دریافت همه قوانین دارای qavaninId در کاتالوگ")
    c.set_defaults(fn=cmd_catalog)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
