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
  # یافتن شناسه سامانه یک قانون از روی عنوان
  python scripts/scraper/qavanin_playwright.py search "قانون تجارت الکترونیکی"

  # دریافت یک قانون با شناسه و ذخیره در data/raw/qavanin-text/electronic-commerce.txt
  python scripts/scraper/qavanin_playwright.py fetch 86054 --slug electronic-commerce

  # دریافت متن همه موارد «در انتظار» کاتالوگ که source.qavaninId دارند (۲۹ مورد)
  python scripts/scraper/qavanin_playwright.py catalog
  # … و به‌روزرسانی متن قوانین موجود از سامانه (بازنویسی فایل‌های خام؛ پس از آن منبع را در کاتالوگ اصلاح کنید)
  python scripts/scraper/qavanin_playwright.py catalog --all

  # به‌روزرسانی «فهرست همه مصوبات» (عنوان/تاریخ/مرجع) — قابل ادامه پس از قطع
  python scripts/scraper/qavanin_playwright.py list --out scripts/scraper/output/qavanin-list.tsv
  python scripts/pipeline/import_qavanin_list.py --tsv scripts/scraper/output/qavanin-list.tsv --merge

پس از دریافت متن: در data/catalog.json منبع قانون را به {"kind": "qavanin-text", "file": "<slug>.txt", "qavaninId": …}
تغییر دهید، سپس `npm run data:laws` و بازبینی data/qa-report.md و در نهایت `npm run data -- --release`.
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
# نشانی متن هر مصوبه با شناسه عددی سامانه (همان شناسه فهرست مصوبات؛ مثلاً 178971 = قانون مدنی)
LAW_URL = BASE + "/Law/TreeText/{id}"
# شناسه‌های رمزشده طولانی (مانند ?IDS=4620049716372613096 در برخی پیوندهای سامانه)
LAW_URL_IDS = BASE + "/Law/TreeText/?IDS={id}"
LIST_URL = BASE + "/"
LIST_HEADER = ["id", "title", "approval_date", "approval_authority"]
_ID_IN_HREF = re.compile(r"(?:IDS=|/Law/TreeText/)(\d+)")


def law_url(law_id: int) -> str:
    return (LAW_URL_IDS if law_id > 10**9 else LAW_URL).format(id=law_id)


def parse_list_page(html: str) -> list[dict]:
    """ردیف‌های جدول فهرست مصوبات (table.slwTable): [ردیف، عنوان+پیوند، تاریخ تصویب، مرجع تصویب]"""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for tr in soup.select("table.slwTable tr"):
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue
        a = tds[1].find("a", href=True)
        m = _ID_IN_HREF.search(a["href"]) if a else None
        if not m:
            continue
        clean = lambda el: re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()  # noqa: E731
        rows.append({"id": int(m.group(1)), "title": clean(tds[1]), "date": clean(tds[2]), "authority": clean(tds[3])})
    return rows
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
        for a in soup.select("table[class*='border'] a[href*='IDS='], table[class*='border'] a[href*='/Law/TreeText/']"):
            m = _ID_IN_HREF.search(a.get("href", ""))
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
    url = law_url(law_id)
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
    targets = []
    for e in catalog["laws"]:
        src = e.get("source", {})
        if not src.get("qavaninId") or e.get("kind") in ("info", "collection") or src.get("segment"):
            continue  # بخش‌های یک فایل (segment) همراه فایل اصلی دریافت می‌شوند
        if src.get("kind") != "pending" and not args.all:
            continue  # پیش‌فرض: فقط موارد «در انتظار»؛ متن قوانین موجود بازنویسی نمی‌شود
        targets.append((int(src["qavaninId"]), src.get("file", f"{e['id']}.txt").removesuffix(".txt"), e.get("unit", "ماده")))
    if args.only:
        wanted = set(args.only.split(","))
        targets = [t for t in targets if t[1] in wanted]
    if not targets:
        print("موردی برای دریافت نیست (source.qavaninId در کاتالوگ؛ برای قوانین موجود از --all استفاده کنید).")
        return
    print(f"{len(targets)} مورد: " + "، ".join(t[1] for t in targets))
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


def _first_row_id(page) -> int | None:
    try:
        href = page.eval_on_selector("table.slwTable tr td a[href]", "a => a.getAttribute('href')")
    except Exception:  # noqa: BLE001
        return None
    m = _ID_IN_HREF.search(href or "")
    return int(m.group(1)) if m else None


def _wait_table_change(page, previous: int | None, timeout: float = 90.0) -> None:
    """پس از تغییر صفحه (ارسال فرم یا AJAX) تا عوض‌شدن نخستین ردیف جدول صبر می‌کند."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        time.sleep(1.0)
        try:
            page.wait_for_selector("table.slwTable", timeout=5000)
        except Exception:  # noqa: BLE001
            continue
        current = _first_row_id(page)
        if current is not None and current != previous:
            return
    raise TimeoutError("جدول فهرست مصوبات به‌روز نشد")


def cmd_list(args) -> None:
    """برداشت فهرست همه مصوبات از صفحه اصلی سامانه (جدول table.slwTable با انتخاب‌گرهای PageSize/PageNumber)."""
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    state_file = out.with_suffix(".state.json")
    state = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() and not args.restart else {}
    start = args.start_page or state.get("next_page", 1)
    seen: set[int] = set()
    if out.exists() and not args.restart:
        with out.open(encoding="utf-8") as f:
            next(f, None)
            seen = {int(line.split("\t", 1)[0]) for line in f if line.strip()}
    else:
        out.write_text("\t".join(LIST_HEADER) + "\n", encoding="utf-8")

    pw, browser, context = open_browser(not args.headed)
    polite = Politeness(args.interval)
    polite.load_robots(context)
    page = context.new_page()
    try:
        goto_with_retry(page, LIST_URL, polite, "table.slwTable")
        if args.page_size:
            before = _first_row_id(page)
            page.select_option("#PageSize", str(args.page_size))
            try:
                _wait_table_change(page, before, timeout=30)
            except TimeoutError:
                pass  # ممکن است نخستین ردیف تغییر نکند
        options = page.eval_on_selector_all("#PageNumber option", "els => els.map(e => e.value).filter(Boolean)")
        last = min(len(options), start + args.max_pages - 1) if args.max_pages else len(options)
        print(f"صفحات {start} تا {last} از {len(options)} (اندازه صفحه {args.page_size})")
        for n in range(start, last + 1):
            polite.wait()
            if n != 1 or start != 1:
                before = _first_row_id(page)
                page.select_option("#PageNumber", str(n))
                _wait_table_change(page, before)
            rows = parse_list_page(page.content())
            fresh = [r for r in rows if r["id"] not in seen]
            with out.open("a", encoding="utf-8") as f:
                for r in fresh:
                    f.write("\t".join(str(r[k]).replace("\t", " ") for k in ("id", "title", "date", "authority")) + "\n")
                    seen.add(r["id"])
            state_file.write_text(json.dumps({"next_page": n + 1, "rows": len(seen), "updatedAt": datetime.now(timezone.utc).isoformat()}) + "\n")
            print(f"  صفحه {n}: {len(rows)} ردیف (+{len(fresh)} جدید) — مجموع {len(seen):,}")
    finally:
        browser.close()
        pw.stop()
    print(f"✓ {out} — اکنون: python scripts/pipeline/import_qavanin_list.py --tsv {out} --merge")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--interval", type=float, default=8.0, help="حداقل فاصله بین درخواست‌ها (ثانیه)")
    ap.add_argument("--headed", action="store_true", help="نمایش مرورگر (برای عیب‌یابی)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search", help="جستجوی عنوان و نمایش شناسه‌ها")
    s.add_argument("query")
    s.set_defaults(fn=cmd_search)
    f = sub.add_parser("fetch", help="دریافت یک قانون با شناسه سامانه (مثلاً 86054 = قانون تجارت الکترونیکی)")
    f.add_argument("id", type=int)
    f.add_argument("--slug", required=True, help="نام فایل خروجی (بدون پسوند)، مثلاً electronic-commerce")
    f.add_argument("--unit", default="ماده", help="واحد شماره‌گذاری: ماده یا اصل")
    f.set_defaults(fn=cmd_fetch)
    c = sub.add_parser("catalog", help="دریافت متن موارد کاتالوگ دارای qavaninId (پیش‌فرض: فقط موارد در انتظار)")
    c.add_argument("--all", action="store_true", help="به‌روزرسانی متن قوانین موجود نیز (بازنویسی فایل‌های خام)")
    c.add_argument("--only", help="فقط این slugها (جداشده با کاما)، مثلاً electronic-commerce,vat")
    c.set_defaults(fn=cmd_catalog)
    li = sub.add_parser("list", help="برداشت فهرست همه مصوبات (عنوان، تاریخ، مرجع) — قابل ادامه")
    li.add_argument("--out", default=str(Path(__file__).resolve().parent / "output" / "qavanin-list.tsv"))
    li.add_argument("--page-size", type=int, default=1000, help="تعداد ردیف هر صفحه در سامانه")
    li.add_argument("--start-page", type=int, default=0, help="شروع از این صفحه (پیش‌فرض: ادامه از آخرین صفحه)")
    li.add_argument("--max-pages", type=int, default=0, help="حداکثر صفحات در این اجرا (۰ = همه)")
    li.add_argument("--restart", action="store_true", help="شروع از ابتدا و بازنویسی خروجی")
    li.set_defaults(fn=cmd_list)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
