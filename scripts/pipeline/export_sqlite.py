#!/usr/bin/env python3
"""
خروجی SQLite از داده‌های متعارف قوانین (data/laws/*.json)

خروجی: data/build/lawbook.sqlite  (در .gitignore؛ برای انتشار جداگانه یا استفاده در بک‌اند)
جداول:
  laws(id, title, short_title, hierarchy, category, doc_type, unit, approval_date, approval_year,
       authority, status, articles, last_updated, source_url, verification)
  toc(law_id, id, parent_id, title, depth, first_key, article_count)
  articles(id, law_id, key, number, suffix, label, ord, heading_id, text, notes_json,
           amendments_json, status, refs_json, keywords_json)
  articles_fts  (FTS5 روی متن نرمال‌شده برای جستجوی سریع سمت سرور)

اجرا:
  python3 scripts/pipeline/export_sqlite.py [--out data/build/lawbook.sqlite]
نمونه پرس‌وجو:
  sqlite3 data/build/lawbook.sqlite "SELECT id,label FROM articles_fts WHERE articles_fts MATCH 'مهریه' LIMIT 5"
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from normalize_fa import normalize_search  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

SCHEMA = """
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
CREATE TABLE laws (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, short_title TEXT, hierarchy TEXT, category TEXT, doc_type TEXT,
  unit TEXT, approval_date TEXT, approval_year INTEGER, authority TEXT, status TEXT, articles INTEGER,
  last_updated TEXT, source_url TEXT, verification TEXT, content_hash TEXT
);
CREATE TABLE toc (
  law_id TEXT NOT NULL REFERENCES laws(id), id TEXT NOT NULL, parent_id TEXT, title TEXT NOT NULL,
  depth INTEGER, first_key TEXT, article_count INTEGER, PRIMARY KEY (law_id, id)
);
CREATE TABLE articles (
  id TEXT PRIMARY KEY, law_id TEXT NOT NULL REFERENCES laws(id), key TEXT NOT NULL, number INTEGER,
  suffix TEXT, label TEXT, ord INTEGER, heading_id TEXT, text TEXT NOT NULL, notes_json TEXT,
  amendments_json TEXT, status TEXT, refs_json TEXT, keywords_json TEXT
);
CREATE INDEX idx_articles_law ON articles(law_id, ord);
CREATE INDEX idx_articles_number ON articles(law_id, number);
CREATE VIRTUAL TABLE articles_fts USING fts5(id UNINDEXED, law_id UNINDEXED, label, body, tokenize = 'unicode61');
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "data" / "build" / "lawbook.sqlite"))
    args = ap.parse_args()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    con = sqlite3.connect(out)
    con.executescript(SCHEMA)
    version = json.loads((ROOT / "data" / "version.json").read_text(encoding="utf-8")).get("version")
    n_articles = 0
    files = sorted(p for p in (ROOT / "data" / "laws").glob("*.json") if p.name != "index.json")
    for p in files:
        law = json.loads(p.read_text(encoding="utf-8"))
        ap_ = law.get("approval") or {}
        src = law.get("source") or {}
        con.execute(
            "INSERT INTO laws VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                law["id"], law["title"], law.get("shortTitle"), law["hierarchy"], law["category"], law["docType"], law["unit"],
                ap_.get("date"), ap_.get("year"), ap_.get("authority"), law.get("status"), law["stats"]["articles"],
                law.get("lastUpdated"), src.get("url"), src.get("verification"), law.get("contentHash"),
            ),
        )
        con.executemany(
            "INSERT INTO toc VALUES (?,?,?,?,?,?,?)",
            [(law["id"], t["id"], t["parent"], t["title"], t["depth"], t["first"], t["count"]) for t in law["toc"]],
        )
        rows, fts = [], []
        for i, a in enumerate(law["articles"]):
            aid = f"{law['id']}:{a['key']}"
            rows.append(
                (
                    aid, law["id"], a["key"], a["number"], a.get("suffix") or None, a["label"], i, a.get("heading"), a["text"],
                    json.dumps(a.get("notes", []), ensure_ascii=False), json.dumps(a.get("amendments", []), ensure_ascii=False),
                    a["status"], json.dumps(a.get("refs", []), ensure_ascii=False), json.dumps(a.get("keywords", []), ensure_ascii=False),
                )
            )
            body = normalize_search("\n".join([a["text"], *a.get("notes", [])])).replace("\u200c", " ")
            fts.append((aid, law["id"], a["label"], body))
        con.executemany("INSERT INTO articles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
        con.executemany("INSERT INTO articles_fts VALUES (?,?,?,?)", fts)
        n_articles += len(rows)
    con.executemany("INSERT INTO meta VALUES (?,?)", [("version", version), ("articles", str(n_articles))])
    con.commit()
    con.execute("VACUUM")
    con.close()
    print(f"✓ {out.relative_to(ROOT)} — {len(files)} قانون، {n_articles} ماده ({out.stat().st_size / 1024 / 1024:.1f}MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
