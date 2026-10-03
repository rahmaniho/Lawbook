"""
تجزیه‌گر قالب متنی «سامانه ملی قوانین» (qavanin.ir)

قالب ورودی (همان خروجی scripts/scraper/qavanin_playwright.py و دیتاست‌های متن‌باز):

    قانون مدنی                                   ← عنوان
    مصوب 1307/02/18 مجلس شورای ملی با اصلاحات…   ← مشخصات تصویب
    ❯ جلد اول - در اموال                          ← عنوان بخش‌بندی (heading)
    ❯ کتاب اول - …
    ماده 11                                      ← شروع ماده (در قانون اساسی: «اصل 11»)
    متن ماده…
    تبصره 1 - …                                  ← تبصره
    [بند ح به موجب … الحاق شده است]               ← یادداشت ویراستاری منبع

خروجی: ساختار داده با فهرست مطالب (TOC)، مواد، تبصره‌ها، اصلاحات و وضعیت هر ماده.
هیچ متنی تولید یا بازنویسی نمی‌شود؛ تنها نرمال‌سازی نگارشی (normalize_display) اعمال می‌شود.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

from normalize_fa import normalize_display

HEADING_MARK = "❯"

# رتبه طبیعی واژه‌های بخش‌بندی (عدد کمتر = سطح بالاتر)
HEADING_RANKS: dict[str, int] = {
    "جلد": 1,
    "کتاب": 2,
    "بخش": 3,
    "باب": 4,
    "فصل": 5,
    "مبحث": 6,
    "گفتار": 7,
    "فقره": 8,
    "قسمت": 3,
    "ordinal": 9,
    "letter": 9,
    "number": 9,
    "other": 9,
}
INTRO_KEYWORDS = {"مقدمه", "کلیات"}
ORDINALS = {
    "اول",
    "دوم",
    "سوم",
    "چهارم",
    "پنجم",
    "ششم",
    "هفتم",
    "هشتم",
    "نهم",
    "دهم",
}
LETTERS = {"الف", "ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "د", "ذ", "ر", "ز", "ه", "و", "ی"}

AMENDMENT_RE = re.compile(
    r"\((?P<kind>اصلاحی|الحاقی|منسوخ|ملغی|حذف)(?P<body>[^()]*?)(?P<date>\d{4}/\d{1,2}/\d{1,2})(?P<rest>[^()]*)\)"
)
BRACKET_NOTE_RE = re.compile(r"^\[(?P<body>.+)\]\.?$")
DATE_RE = re.compile(r"\d{4}/\d{1,2}/\d{1,2}")
REPEALED_RE = re.compile(
    r"^(\(?\s*)?(\[?\s*منسوخ|به\s*موجب\s.{0,240}?(حذف|ملغی|منسوخ|نسخ)\s*(شده\s*(است|اند)|گردیده\s*(است)?|شد|گردید)|حذف\s*(شده\s*است|شد|گردید)|ملغی\s*(شده\s*)?(است|گردید)|منسوخ\s*(شده\s*)?(است|گردید)?|نسخ\s*(شده\s*است|گردید))"
)
REF_RE = re.compile(r"(?:ماده|مواد)\s*\(?\s*(\d+)\s*\)?((?:\s*(?:،|,|و|تا|الی)\s*\(?\s*\d+\s*\)?)*)")


@dataclass
class Heading:
    id: str
    title: str
    keyword: str
    rank: int
    parent_id: str | None
    depth: int
    first_article: str | None = None
    article_count: int = 0


@dataclass
class Article:
    key: str
    number: int
    suffix: str  # '' یا 'مکرر' یا 'مکرر 2'
    label: str
    heading_id: str | None
    heading_path: list[str]
    lines: list[str] = field(default_factory=list)
    text: str = ""
    notes: list[str] = field(default_factory=list)
    amendments: list[dict] = field(default_factory=list)
    status: str = "لازم‌الاجرا"
    refs: list[str] = field(default_factory=list)


@dataclass
class ParsedLaw:
    title: str
    subtitle: str
    approval_date: str | None
    approval_authority: str | None
    approval_note: str | None
    preamble: str
    headings: list[Heading]
    articles: list[Article]
    warnings: list[str]


def _heading_keyword(title: str) -> str:
    first = re.split(r"[\s\-–:]+", title.strip(), maxsplit=1)[0] if title.strip() else ""
    first = first.replace("\u200c", "")
    if first in HEADING_RANKS and first not in ("ordinal", "letter", "number", "other"):
        return first
    if first in INTRO_KEYWORDS:
        return first
    if first in ORDINALS:
        return "ordinal"
    if first in LETTERS:
        return "letter"
    if first.isdigit():
        return "number"
    return "other"


def parse_subtitle(subtitle: str) -> tuple[str | None, str | None, str | None]:
    """«مصوب 1307/02/18 مجلس شورای ملی با اصلاحات و الحاقات بعدی» → (تاریخ، مرجع، توضیح)"""
    m = re.match(r"^مصوب\s+(\d{4}/\d{1,2}/\d{1,2})\s*(.*)$", subtitle.strip())
    if not m:
        return None, None, None
    date = m.group(1)
    rest = m.group(2).strip()
    note = None
    nm = re.search(r"\s*(با\s+(آخرین\s+)?(اصلاحات|الحاقات).*)$", rest)
    if nm:
        note = nm.group(1).strip()
        rest = rest[: nm.start()].strip()
    y, mo, d = date.split("/")
    return f"{int(y):04d}/{int(mo):02d}/{int(d):02d}", (rest or None), note


def _article_match(line: str, unit: str) -> tuple[int, str] | None:
    compact = line.replace("\u200c", "").strip()
    if compact in (f"{unit} واحده", f"{unit}واحده"):
        return 1, "واحده"
    m = re.match(rf"^{unit}\s+(\d+)(?:\s*(مکرر)(?:\s*(\d+))?)?\s*[-–:]?\s*$", compact)
    if not m:
        return None
    num = int(m.group(1))
    suffix = ""
    if m.group(2):
        suffix = "مکرر" + (f" {m.group(3)}" if m.group(3) else "")
    return num, suffix


def article_key(number: int, suffix: str) -> str:
    if suffix == "واحده":
        return "1"
    if not suffix:
        return str(number)
    m = re.match(r"مکرر(?:\s+(\d+))?$", suffix)
    n = m.group(1) if m else None
    return f"{number}-bis{n or ''}"


def article_label(unit: str, number: int, suffix: str) -> str:
    if suffix == "واحده":
        return f"{unit} واحده"
    return f"{unit} {number}" + (f" {suffix}" if suffix else "")


def detect_status(text: str, notes: list[str], amendments: list[dict]) -> str:
    body = text.strip()
    if body and len(body) < 400 and REPEALED_RE.search(body):
        return "منسوخ"
    if any(a["kind"] in ("اصلاحی", "الحاقی") for a in amendments):
        return "اصلاحی"
    return "لازم‌الاجرا"


def extract_amendments(lines: Iterable[str]) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for line in lines:
        for m in AMENDMENT_RE.finditer(line):
            y, mo, d = m.group("date").split("/")
            date = f"{int(y):04d}/{int(mo):02d}/{int(d):02d}"
            authority = (m.group("body") + " " + m.group("rest")).strip(" -،") or None
            key = (m.group("kind"), date, authority or "")
            if key in seen:
                continue
            seen.add(key)
            out.append({"kind": m.group("kind"), "date": date, "raw": m.group(0), "note": authority})
        bm = BRACKET_NOTE_RE.match(line.strip())
        if bm:
            body = bm.group("body").strip()
            dm = DATE_RE.search(body)
            date = None
            if dm:
                y, mo, d = dm.group(0).split("/")
                date = f"{int(y):04d}/{int(mo):02d}/{int(d):02d}"
            kind = "منسوخ" if "منسوخ" in body else ("الحاقی" if "الحاق" in body else ("اصلاحی" if "اصلاح" in body else "یادداشت"))
            key = (kind, date or "", body)
            if key in seen:
                continue
            seen.add(key)
            out.append({"kind": kind, "date": date, "raw": line.strip(), "note": body})
    return out


def extract_refs(text: str, self_key: str) -> list[str]:
    refs: list[str] = []
    for m in REF_RE.finditer(text):
        tail = text[m.end() : m.end() + 40]
        # ارجاع به قانون دیگر («ماده 5 قانون …») را کنار بگذار مگر «این قانون»
        if re.match(r"^\s*\)?\s*(قانون|آیین|آئین|لایحه|اصلاحی|الحاقی\s+به\s+قانون|کتاب\s+پنجم|تصویب)", tail) and not re.match(
            r"^\s*\)?\s*(این|همین)\s+قانون", tail
        ):
            continue
        nums = [m.group(1)] + re.findall(r"\d+", m.group(2) or "")
        # «مواد 10 تا 15» → بازه
        if m.group(2) and re.search(r"(تا|الی)", m.group(2)) and len(nums) == 2:
            a, b = int(nums[0]), int(nums[1])
            if 0 < b - a <= 30:
                nums = [str(i) for i in range(a, b + 1)]
        for n in nums:
            if n != self_key and n not in refs:
                refs.append(n)
    return refs


def parse_qavanin_lines(raw_lines: list[str], *, unit: str = "ماده", has_header: bool = True) -> ParsedLaw:
    lines = [normalize_display(l) for l in raw_lines]
    warnings: list[str] = []
    title = subtitle = ""
    idx = 0
    if has_header:
        while idx < len(lines) and not lines[idx]:
            idx += 1
        if idx < len(lines):
            title = lines[idx]
            idx += 1
        if idx < len(lines) and lines[idx].startswith("مصوب"):
            subtitle = lines[idx]
            idx += 1
    date, authority, note = parse_subtitle(subtitle) if subtitle else (None, None, None)

    headings: list[Heading] = []
    stack: list[Heading] = []
    articles: list[Article] = []
    preamble_lines: list[str] = []
    current: Article | None = None
    seen_keys: dict[str, int] = {}

    def push_heading(htitle: str) -> Heading:
        kw = _heading_keyword(htitle)
        # عناوین «مقدمه/کلیات» برگ‌اند و با عنوان بعدی کنار می‌روند
        while stack and stack[-1].keyword in INTRO_KEYWORDS:
            stack.pop()
        if kw in INTRO_KEYWORDS:
            rank = 0
        else:
            rank = HEADING_RANKS.get(kw, 9)
            j = next((i for i in range(len(stack) - 1, -1, -1) if stack[i].keyword == kw), None)
            if j is not None:
                natural_parent = next((i for i in range(len(stack) - 1, j, -1) if stack[i].rank < rank), None)
                if natural_parent is None:
                    del stack[j:]
                else:
                    # عنوان هم‌نام در سطح بالاتر هست ولی والد طبیعی بین آن‌ها قرار دارد
                    del stack[natural_parent + 1 :]
            elif rank <= 2:
                # «جلد/کتاب» تازه: هر عنوان هم‌سطح یا پایین‌تر بسته می‌شود
                while stack and stack[-1].rank >= rank:
                    stack.pop()
        parent = stack[-1] if stack else None
        h = Heading(
            id=f"h{len(headings) + 1}",
            title=htitle,
            keyword=kw,
            rank=rank,
            parent_id=parent.id if parent else None,
            depth=len(stack),
        )
        headings.append(h)
        stack.append(h)
        return h

    for line in lines[idx:]:
        if line.startswith(HEADING_MARK):
            htitle = line[len(HEADING_MARK) :].strip()
            if htitle:
                push_heading(htitle)
                current = None
            continue
        am = _article_match(line, unit)
        if am:
            num, suffix = am
            key = article_key(num, suffix)
            if key in seen_keys:
                seen_keys[key] += 1
                warnings.append(f"کلید تکراری {unit} {key} (مورد {seen_keys[key]})")
                key = f"{key}-dup{seen_keys[key]}"
            else:
                seen_keys[key] = 1
            hid = stack[-1].id if stack else None
            path = [h.title for h in stack]
            current = Article(
                key=key,
                number=num,
                suffix=suffix,
                label=article_label(unit, num, suffix),
                heading_id=hid,
                heading_path=path,
            )
            articles.append(current)
            for h in stack:
                h.article_count += 1
                if h.first_article is None:
                    h.first_article = key
            continue
        if current is None:
            if not articles:
                # متن پیش از نخستین ماده (مثلاً مقدمه قانون اساسی)
                preamble_lines.append(line)
            elif line:
                warnings.append(f"خط بیرون از ماده پس از عنوان «{stack[-1].title if stack else ''}»: {line[:80]}")
            continue
        current.lines.append(line)

    for a in articles:
        body: list[str] = []
        notes: list[str] = []
        in_notes = False
        for line in a.lines:
            if not line:
                continue
            if re.match(r"^تبصره(\s|$|\s*\d|\s*[-–:(]|‌)", line):
                in_notes = True
                notes.append(line)
            elif in_notes:
                notes[-1] = notes[-1] + "\n" + line
            else:
                body.append(line)
        a.text = "\n".join(body).strip()
        a.notes = notes
        a.amendments = extract_amendments(a.lines)
        a.status = detect_status(a.text, a.notes, a.amendments)
        a.refs = extract_refs("\n".join([a.text] + a.notes), a.key)
        if not a.text and not a.notes:
            warnings.append(f"{a.label} بدون متن است")
        del a.lines[:]

    # حذف ارجاع به کلیدهای ناموجود
    keys = {a.key for a in articles}
    for a in articles:
        a.refs = [r for r in a.refs if r in keys]

    preamble = "\n".join(l for l in preamble_lines).strip()
    return ParsedLaw(
        title=title,
        subtitle=subtitle,
        approval_date=date,
        approval_authority=authority,
        approval_note=note,
        preamble=preamble,
        headings=headings,
        articles=articles,
        warnings=warnings,
    )


def split_segments(raw_text: str, segments: list[dict] | None) -> dict[str | None, list[str]]:
    """
    برش فایل خام به چند «قانون» (مثلاً کتاب پنجم مجازات اسلامی یا لایحه اصلاحی تجارت).
    هر segment: {"id": ..., "start": "پیشوند عنوان شروع", "end": "پیشوند عنوان پایان" | null}
    خطِ عنوانِ شروع جزو بخش جدا شده حذف می‌شود (عنوانِ آن قانون است).
    خطوطی که در هیچ segmentی نیستند به کلید None (قانون اصلی) تعلق دارند.
    """
    lines = raw_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    result: dict[str | None, list[str]] = {None: []}
    if not segments:
        result[None] = lines
        return result

    def norm(s: str) -> str:
        return normalize_display(s).replace(HEADING_MARK, "").replace("\u200c", "").strip()

    active: dict | None = None
    for line in lines:
        n = norm(line)
        is_heading = line.strip().startswith(HEADING_MARK)
        if active is not None and is_heading and active.get("end") and n.startswith(norm(active["end"])):
            active = None
        if active is None and is_heading:
            seg = next((s for s in segments if n.startswith(norm(s["start"]))), None)
            if seg is not None:
                active = seg
                result.setdefault(seg["id"], [])
                continue
        if active is None:
            result[None].append(line)
        else:
            result[active["id"]].append(line)
    return result
