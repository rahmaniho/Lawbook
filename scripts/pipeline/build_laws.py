#!/usr/bin/env python3
"""
ساخت داده‌های ساخت‌یافته قوانین از متن‌های خام.

ورودی:
  data/catalog.json            فهرست قوانین و فراداده (عنوان، دسته، سلسله‌مراتب، منبع)
  data/glossary.json           واژه‌نامه مفاهیم برای کلیدواژه‌ها
  data/raw/qavanin-text/*.txt  متن خام با قالب سامانه ملی قوانین

خروجی:
  data/laws/<law-id>.json      داده متعارف (canonical) هر قانون — قابل بازبینی در Git
  data/laws/index.json         فهرست + آمار + هش محتوا
  data/qa-report.md            گزارش کنترل کیفیت (شماره‌گذاری، تکرار، مواد بدون متن، …)

اجرا:
  python3 scripts/pipeline/build_laws.py
"""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from normalize_fa import normalize_display, normalize_search, tokenize_search  # noqa: E402
from parse_qavanin import parse_qavanin_lines, split_segments  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RAW = DATA / "raw" / "qavanin-text"
OUT = DATA / "laws"
SCHEMA_VERSION = 1


def gregorian_to_jalali(gy: int, gm: int, gd: int) -> tuple[int, int, int]:
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + (365 * gy) + ((gy2 + 3) // 4) - ((gy2 + 99) // 100) + ((gy2 + 399) // 400) + gd + g_d_m[gm - 1]
    jy = -1595 + (33 * (days // 12053))
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + (days // 31)
        jd = 1 + (days % 31)
    else:
        jm = 7 + ((days - 186) // 30)
        jd = 1 + ((days - 186) % 30)
    return jy, jm, jd


def jalali_str(iso: str) -> str:
    y, m, d = (int(x) for x in iso.split("-"))
    jy, jm, jd = gregorian_to_jalali(y, m, d)
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


class Tagger:
    """برچسب‌گذاری کلیدواژه‌ها بر اساس عبارات match واژه‌نامه (تطبیق کامل توکن‌ها)."""

    def __init__(self, glossary: dict):
        self.rules: list[tuple[str, list[list[str]]]] = []
        for c in glossary["concepts"]:
            phrases = [tokenize_search(p) for p in c["match"]]
            phrases = [[t for t in p if t] for p in phrases]
            self.rules.append((c["term"], [p for p in phrases if p]))

    def tags(self, text: str) -> list[str]:
        toks = tokenize_search(text)
        token_set = set(toks)
        stream = " " + " ".join(toks) + " "
        out = []
        for term, phrases in self.rules:
            for p in phrases:
                if (len(p) == 1 and p[0] in token_set) or (len(p) > 1 and (" " + " ".join(p) + " ") in stream):
                    out.append(term)
                    break
        return out


def build_law(entry: dict, catalog: dict, tagger: Tagger, raw_cache: dict, segment_owner: dict) -> tuple[dict, list[str]]:
    src = entry["source"]
    raw_path = RAW / src["file"]
    raw_bytes = raw_path.read_bytes()
    raw_text = raw_bytes.decode("utf-8-sig")

    # برش‌های تعریف‌شده روی این فایل (برای قانون اصلی و قوانین جداشده)
    segs = segment_owner.get(src["file"], [])
    parts = raw_cache.get(src["file"])
    if parts is None:
        parts = split_segments(raw_text, segs)
        raw_cache[src["file"]] = parts

    if src.get("segment"):
        lines = parts.get(entry["id"], [])
        header_lines: list[str] = []
        # عنوان/مشخصات قانون جداشده از کاتالوگ می‌آید
        parsed = parse_qavanin_lines(header_lines + lines, unit=entry.get("unit", "ماده"), has_header=False)
    else:
        parsed = parse_qavanin_lines(parts[None], unit=entry.get("unit", "ماده"), has_header=True)

    warnings = list(parsed.warnings)
    up = catalog["upstreams"].get(src.get("upstream", ""), {})

    approval = dict(entry.get("approval") or {})
    if not approval.get("date") and parsed.approval_date:
        approval["date"] = parsed.approval_date
    if not approval.get("authority") and parsed.approval_authority:
        approval["authority"] = parsed.approval_authority
    if parsed.approval_note and not src.get("segment"):
        approval.setdefault("note", parsed.approval_note)
    if approval.get("date"):
        approval["year"] = int(approval["date"][:4])

    if parsed.title and normalize_display(parsed.title) not in (entry["title"], entry.get("shortTitle")):
        warnings.append(f"عنوان فایل خام «{parsed.title}» با عنوان کاتالوگ «{entry['title']}» متفاوت است (عنوان کاتالوگ استفاده شد).")

    heading_by_id = {h.id: h for h in parsed.headings}
    toc = [
        {
            "id": h.id,
            "title": h.title,
            "parent": h.parent_id,
            "depth": h.depth,
            "first": h.first_article,
            "count": h.article_count,
        }
        for h in parsed.headings
    ]

    articles = []
    for a in parsed.articles:
        full = "\n".join([a.text] + a.notes)
        art = {
            "key": a.key,
            "number": a.number,
            "suffix": a.suffix,
            "label": a.label,
            "heading": a.heading_id,
            "text": a.text,
        }
        if a.notes:
            art["notes"] = a.notes
        if a.amendments:
            art["amendments"] = a.amendments
        art["status"] = a.status
        if a.refs:
            art["refs"] = a.refs
        kw = tagger.tags(full + "\n" + " ".join(a.heading_path[-1:]))
        if kw:
            art["keywords"] = kw
        articles.append(art)

    snapshot = up.get("snapshotDate")
    content_hash = sha256_bytes(
        json.dumps({"preamble": parsed.preamble, "toc": toc, "articles": articles}, ensure_ascii=False, sort_keys=True).encode()
    )
    stats = {
        "articles": len(articles),
        "notes": sum(len(a.get("notes", [])) for a in articles),
        "repealed": sum(1 for a in articles if a["status"] == "منسوخ"),
        "amended": sum(1 for a in articles if a["status"] == "اصلاحی"),
        "headings": len(toc),
        "characters": sum(len(a["text"]) + sum(len(n) for n in a.get("notes", [])) for a in articles) + len(parsed.preamble),
    }

    # کنترل پیوستگی شماره‌گذاری
    nums = [a["number"] for a in articles if not a["suffix"]]
    expected_gaps = set()
    for g in entry.get("expectedGaps", []):
        expected_gaps.update(range(g["from"], g["to"] + 1))
    if nums:
        missing = sorted(set(range(min(nums), max(nums) + 1)) - set(nums) - expected_gaps)
        if missing:
            warnings.append(f"شماره‌های جاافتاده: {missing[:40]}{' …' if len(missing) > 40 else ''}")
    empty = [a["label"] for a in articles if not a["text"] and not a.get("notes")]
    if empty:
        warnings.append(f"مواد بدون متن: {empty[:20]}")

    law = {
        "schemaVersion": SCHEMA_VERSION,
        "id": entry["id"],
        "title": entry["title"],
        "shortTitle": entry.get("shortTitle", entry["title"]),
        "aliases": entry.get("aliases", []),
        "hierarchy": entry["hierarchy"],
        "category": entry["category"],
        "docType": entry["docType"],
        "unit": entry.get("unit", "ماده"),
        "status": entry.get("status", "لازم‌الاجرا"),
        "priority": entry.get("priority", 0),
        "featured": bool(entry.get("featured")),
        "approval": approval,
        "approvalNote": entry.get("approvalNote"),
        "description": entry.get("description"),
        "crossLinks": entry.get("crossLinks", []),
        "expectedGaps": entry.get("expectedGaps", []),
        "source": {
            "kind": src["kind"],
            "origin": up.get("origin"),
            "upstream": up.get("name"),
            "license": up.get("license"),
            "url": f"{up['repo']}/blob/{up['commit']}/{up['path']}/{src['originalFile']}" if up else None,
            "rawFile": str(raw_path.relative_to(ROOT)),
            "rawSha256": sha256_bytes(raw_bytes),
            "segment": src.get("segment"),
            "qavaninId": src.get("qavaninId"),
            "officialUrl": QAVANIN_LAW_URL.format(id=src["qavaninId"]) if src.get("qavaninId") else None,
            "snapshotDate": snapshot,
            "snapshotDateJalali": jalali_str(snapshot) if snapshot else None,
            "verification": src.get("verification", "source-copy"),
        },
        "lastUpdated": jalali_str(snapshot) if snapshot else None,
        "contentHash": content_hash,
        "stats": stats,
        "preamble": parsed.preamble,
        "toc": toc,
        "articles": articles,
    }
    _ = heading_by_id
    return law, warnings


QAVANIN_LAW_URL = "https://qavanin.ir/Law/TreeText/{id}"
QINDEX_FILE = DATA / "raw" / "qavanin-index" / "qavanin-list.tsv.gz"


def _match_key(s: str) -> str:
    return re.sub(r"[\s\u200c()«»\"'،,\-]+", "", normalize_search(s))


def check_qavanin_ids(catalog: dict) -> list[str]:
    """شناسه‌های سامانه ملی قوانین در کاتالوگ باید در فهرست عناوین موجود و با عنوان/تاریخ تصویب سازگار باشند."""
    if not QINDEX_FILE.exists():
        return ["فهرست عناوین سامانه (data/raw/qavanin-index/qavanin-list.tsv.gz) یافت نشد؛ شناسه‌ها بررسی نشدند."]
    wanted: dict[int, list[tuple[str, str, str]]] = {}
    for e in catalog["laws"]:
        refs = [(e.get("source") or {}).get("qavaninId")] + [m.get("qavaninId") for m in e.get("members", [])]
        for q in refs:
            if q:
                wanted.setdefault(int(q), []).append((e["id"], e["title"], (e.get("approval") or {}).get("date", "")))
    found: dict[int, tuple[str, str]] = {}
    with gzip.open(QINDEX_FILE, "rt", encoding="utf-8") as f:
        next(f)
        for line in f:
            parts = line.rstrip("\n").split("\t")
            q = int(parts[0])
            if q in wanted:
                found[q] = (parts[1], parts[2])
    warnings = []
    for q, owners in wanted.items():
        if q not in found:
            warnings.append(f"شناسه {q} ({owners[0][0]}) در فهرست عناوین سامانه نیست.")
            continue
        title, approved = found[q]
        for law_id, law_title, law_date in owners:
            if law_id == "development-plans":
                continue
            core = _match_key(law_title.split(" (")[0])
            if core not in _match_key(title) and _match_key(title) not in _match_key(law_title):
                warnings.append(f"عنوان {law_id} («{law_title}») با عنوان شناسه {q} در سامانه («{title}») هم‌خوان نیست.")
            if law_date and approved and law_date != approved and law_id not in ("civil-code",):
                warnings.append(f"تاریخ تصویب {law_id} ({law_date}) با سامانه ({approved}، شناسه {q}) متفاوت است.")
    return warnings


def main() -> int:
    catalog = json.loads((DATA / "catalog.json").read_text(encoding="utf-8"))
    glossary = json.loads((DATA / "glossary.json").read_text(encoding="utf-8"))
    tagger = Tagger(glossary)
    OUT.mkdir(parents=True, exist_ok=True)

    # ثبت segmentهای هر فایل
    segment_owner: dict[str, list[dict]] = {}
    for e in catalog["laws"]:
        s = e.get("source", {})
        if s.get("kind") == "qavanin-text" and s.get("segment"):
            segment_owner.setdefault(s["file"], []).append({"id": e["id"], **s["segment"]})

    # کنترل تکراری بودن نام‌های مستعار
    alias_owner: dict[str, str] = {}
    alias_warnings = []
    for e in catalog["laws"]:
        for al in e.get("aliases", []):
            k = normalize_display(al)
            if k in alias_owner and alias_owner[k] != e["id"]:
                alias_warnings.append(f"نام مستعار «{al}» هم برای {alias_owner[k]} و هم {e['id']} تعریف شده است.")
            alias_owner.setdefault(k, e["id"])

    raw_cache: dict = {}
    index = []
    report = ["# گزارش کنترل کیفیت داده‌ها", "", f"تاریخ ساخت: {date.today().isoformat()}", ""]
    qid_warnings = check_qavanin_ids(catalog)
    if alias_warnings or qid_warnings:
        report += ["## هشدارهای کاتالوگ", ""] + [f"- {w}" for w in alias_warnings + qid_warnings] + [""]
    linked = sum(1 for e in catalog["laws"] if (e.get("source") or {}).get("qavaninId"))
    report += [f"شناسه سامانه ملی قوانین (qavaninId) برای {linked} مورد از {len(catalog['laws'])} مورد کاتالوگ ثبت و با فهرست عناوین تطبیق داده شد.", ""]
    for w in qid_warnings:
        print("⚠", w)
    report += ["## خلاصه", "", "| قانون | مواد | تبصره | منسوخ | اصلاحی | عناوین | هشدار |", "|---|---:|---:|---:|---:|---:|---:|"]
    details = []
    total_articles = 0
    written = set()
    for e in catalog["laws"]:
        if e.get("source", {}).get("kind") != "qavanin-text":
            continue
        law, warns = build_law(e, catalog, tagger, raw_cache, segment_owner)
        path = OUT / f"{law['id']}.json"
        path.write_text(json.dumps(law, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        written.add(path.name)
        st = law["stats"]
        total_articles += st["articles"]
        index.append(
            {
                "id": law["id"],
                "title": law["title"],
                "file": f"laws/{path.name}",
                "contentHash": law["contentHash"],
                "stats": st,
            }
        )
        report.append(
            f"| {law['title']} | {st['articles']} | {st['notes']} | {st['repealed']} | {st['amended']} | {st['headings']} | {len(warns)} |"
        )
        if warns:
            details.append(f"### {law['title']} (`{law['id']}`)")
            details.append("")
            details += [f"- {w}" for w in warns[:60]]
            if len(warns) > 60:
                details.append(f"- … و {len(warns) - 60} هشدار دیگر")
            details.append("")
        print(f"✓ {law['id']:<34} {st['articles']:>5} مواد  {len(warns):>3} هشدار")

    # حذف فایل‌های قدیمی
    for p in OUT.glob("*.json"):
        if p.name not in written and p.name != "index.json":
            p.unlink()

    (OUT / "index.json").write_text(
        json.dumps({"schemaVersion": SCHEMA_VERSION, "laws": index}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    report += ["", f"**جمع کل مواد:** {total_articles}", ""]
    if details:
        report += ["## جزئیات هشدارها", ""] + details
    (DATA / "qa-report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"\nجمع: {len(index)} قانون، {total_articles} ماده/اصل → data/laws/  |  گزارش: data/qa-report.md")
    kw = Counter()
    for item in index:
        law = json.loads((OUT / Path(item["file"]).name).read_text(encoding="utf-8"))
        for a in law["articles"]:
            kw.update(a.get("keywords", []))
    print("پرتکرارترین کلیدواژه‌ها:", ", ".join(f"{k}:{v}" for k, v in kw.most_common(12)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
