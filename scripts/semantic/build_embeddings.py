#!/usr/bin/env python3
"""
(اختیاری) ساخت بردارهای معنایی برای جستجوی معنایی واقعی سمت سرور

مدل پیش‌فرض: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (۳۸۴ بعدی، پشتیبانی فارسی)
خروجی:
  data/build/embeddings.f16.npy   ماتریس float16 (n × 384)
  data/build/embeddings.ids.json  شناسه مواد هم‌ترتیب با ماتریس
  (اختیاری) جدول sqlite-vec در data/build/lawbook.sqlite با --sqlite-vec

اجرا (روی سیستمی با دسترسی به huggingface.co):
  pip install sentence-transformers numpy sqlite-vec
  python scripts/semantic/build_embeddings.py [--model …] [--sqlite-vec]

نکته: اپ PWA به‌صورت پیش‌فرض «جستجوی مفهومی سبک» (گسترش پرس‌وجو با واژه‌نامه data/glossary.json) را
کاملاً آفلاین انجام می‌دهد؛ این اسکریپت برای افزودن یک API معنایی (pgvector/sqlite-vec) در آینده است.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "pipeline"))
from normalize_fa import normalize_search  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--sqlite-vec", action="store_true")
    args = ap.parse_args()

    import numpy as np
    from sentence_transformers import SentenceTransformer

    ids, texts = [], []
    for p in sorted((ROOT / "data" / "laws").glob("*.json")):
        if p.name == "index.json":
            continue
        law = json.loads(p.read_text(encoding="utf-8"))
        for a in law["articles"]:
            ids.append(f"{law['id']}:{a['key']}")
            body = "\n".join([a["text"], *a.get("notes", [])])
            texts.append(normalize_search(f"{law['shortTitle']} {a['label']}: {body}")[:2000])

    model = SentenceTransformer(args.model)
    emb = model.encode(texts, batch_size=args.batch, show_progress_bar=True, normalize_embeddings=True)
    out = ROOT / "data" / "build"
    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "embeddings.f16.npy", emb.astype("float16"))
    (out / "embeddings.ids.json").write_text(json.dumps(ids), encoding="utf-8")
    print(f"✓ {len(ids)} بردار → data/build/embeddings.f16.npy")

    if args.sqlite_vec:
        import sqlite3

        import sqlite_vec

        con = sqlite3.connect(out / "lawbook.sqlite")
        con.enable_load_extension(True)
        sqlite_vec.load(con)
        con.execute(f"CREATE VIRTUAL TABLE IF NOT EXISTS article_vec USING vec0(id TEXT PRIMARY KEY, embedding float[{emb.shape[1]}])")
        con.executemany("INSERT OR REPLACE INTO article_vec(id, embedding) VALUES (?, ?)", [(i, e.astype("float32").tobytes()) for i, e in zip(ids, emb)])
        con.commit()
        print("✓ جدول article_vec در lawbook.sqlite ساخته شد")


if __name__ == "__main__":
    main()
