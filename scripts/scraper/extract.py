"""
تبدیل HTML صفحه «متن تلفیقی» سامانه ملی قوانین (qavanin.ir/Law/TreeText/?IDS=…) به قالب متنی
qavanin-text که scripts/pipeline/parse_qavanin.py آن را می‌خواند.

ساختار شناخته‌شده صفحه:
  div[id*=treeText]                    ظرف متن
    p[class*=SecTex]                   هر بند/عنوان/ماده
      span[class*="bold blue"]         برچسب (مثلاً «ماده 10»، «فصل اول - …»، «تبصره 1»)
    table                              جدول‌های داخل قانون
  table[class*=w100] h1..h6            عنوان و مشخصات قانون

این ماژول خالص است (فقط BeautifulSoup) و بدون شبکه قابل تست است.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

PARENT_KEYWORDS = ("جلد", "کتاب", "بخش", "باب", "فصل", "مبحث", "گفتار", "فقره", "قسمت", "مقدمه", "کلیات")
ARTICLE_RE = re.compile(r"^(ماده|اصل)\s*(\d+|واحده)(\s*مکرر(\s*\d+)?)?\s*[-–:.]?\s*")
APPROVAL_RE = re.compile(r"مصوب\s+\d{4}/\d{1,2}/\d{1,2}[^\n]*")
DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def _clean(s: str) -> str:
    s = s.replace("\xa0", " ").translate(DIGITS)
    return re.sub(r"[ \t]+", " ", s).strip()


def _label_of(p: Tag) -> str:
    span = p.select_one("span[class*='bold'][class*='blue']") or p.select_one("span.bold, b, strong")
    return _clean(span.get_text(" ", strip=True)) if span else ""


def extract_title(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    """عنوان و سطر «مصوب …» از سربرگ صفحه"""
    title = None
    approval = None
    heads = []
    for tbl in soup.select("table[class*='w100']"):
        heads += [_clean(h.get_text(" ", strip=True)) for h in tbl.select("h1, h2, h3, h4, h5, h6")]
    if not heads:
        heads = [_clean(h.get_text(" ", strip=True)) for h in soup.select("h1, h2, h3")]
    for h in heads:
        if not h:
            continue
        m = APPROVAL_RE.search(h)
        if m and not approval:
            approval = _clean(m.group(0))
            rest = _clean(h[: m.start()])
            if rest and not title:
                title = rest
        elif not title:
            title = h
    if not title and soup.title:
        title = _clean(soup.title.get_text())
    return title, approval


def _table_lines(tbl: Tag) -> list[str]:
    lines = []
    for tr in tbl.select("tr"):
        cells = [_clean(td.get_text(" ", strip=True)) for td in tr.select("th, td")]
        cells = [c for c in cells if c]
        if cells:
            lines.append(" | ".join(cells))
    return lines


def html_to_qavanin_text(html: str, *, title: str | None = None, approval: str | None = None, unit: str = "ماده") -> str:
    soup = BeautifulSoup(html, "lxml") if _has_lxml() else BeautifulSoup(html, "html.parser")
    t, a = extract_title(soup)
    title = title or t or ""
    approval = approval or a or ""
    container = soup.select_one("div[id*='treeText']") or soup.body or soup
    out: list[str] = [title, approval] if approval else [title]

    for el in container.select("p[class*='SecTex'], table"):
        if el.name == "table":
            if el.find_parent("p"):
                continue
            out += _table_lines(el)
            continue
        text = _clean(el.get_text(" ", strip=True))
        if len(text) <= 1:
            continue
        label = _label_of(el)
        head = label.split(" ")[0].replace("\u200c", "") if label else ""
        m = ARTICLE_RE.match(text) if (label and ARTICLE_RE.match(label)) else None
        if head in PARENT_KEYWORDS and not m:
            out.append(f"❯ {text}")
        elif m:
            num = m.group(2)
            suffix = " مکرر" + (f" {m.group(4).strip()}" if m.group(4) else "") if m.group(3) else ""
            u = m.group(1)
            if out and out[-1] != "":
                out.append("")
            out.append(f"{u} {num}{suffix}" if num != "واحده" else f"{u} واحده")
            rest = text[m.end() :].strip()
            if rest:
                out.append(rest)
        else:
            out.append(text)
    # حذف خطوط خالی تکراری
    cleaned: list[str] = []
    for line in out:
        if line == "" and cleaned and cleaned[-1] == "":
            continue
        cleaned.append(line)
    return "\n".join(cleaned).strip() + "\n"


def plain_text_to_qavanin_text(lines: list[str], *, title: str, approval: str = "") -> str:
    """
    تبدیل متن ساده (مثلاً از rc.majlis.ir) به قالب qavanin-text:
    «ماده 1- متن…» ← «ماده 1» + «متن…» ؛ «فصل اول - …» ← «❯ فصل اول - …»
    """
    out = [title] + ([approval] if approval else [])
    for raw in lines:
        line = _clean(raw)
        if not line:
            continue
        head = line.split(" ")[0].replace("\u200c", "")
        m = ARTICLE_RE.match(line)
        if m:
            num = m.group(2)
            suffix = " مکرر" + (f" {m.group(4).strip()}" if m.group(4) else "") if m.group(3) else ""
            out += ["", f"{m.group(1)} {num}{suffix}" if num != "واحده" else f"{m.group(1)} واحده"]
            rest = line[m.end() :].strip()
            if rest:
                out.append(rest)
        elif head in PARENT_KEYWORDS and len(line) < 160 and " - " in line[:40]:
            out.append(f"❯ {line}")
        else:
            out.append(line)
    return "\n".join(out).strip() + "\n"


def _has_lxml() -> bool:
    try:
        import lxml  # noqa: F401

        return True
    except ImportError:
        return False
