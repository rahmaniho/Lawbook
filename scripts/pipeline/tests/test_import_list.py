import gzip
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from import_qavanin_list import clean, read_tsv, write_tsv  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]


class ImportListTest(unittest.TestCase):
    def test_clean_keeps_text_verbatim(self):
        # فقط TAB/خط‌جدید به فاصله تبدیل می‌شود؛ حروف عربی و نیم‌فاصله دست نمی‌خورند
        self.assertEqual(clean("قانون\tماليات‌هاي\nمستقيم "), "قانون ماليات‌هاي مستقيم")
        self.assertEqual(clean(None), "")
        self.assertEqual(clean("nan"), "")

    def test_roundtrip_is_deterministic(self):
        rows = [["2", "قانون مدني", "1314/08/08", "مجلس شوراي ملي"], ["10", "آيين‌نامه", "", ""]]
        with tempfile.TemporaryDirectory() as d:
            a, b = Path(d) / "a.tsv.gz", Path(d) / "b.tsv.gz"
            write_tsv(rows, a)
            write_tsv(rows, b)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            self.assertEqual(read_tsv(a), rows)

    def test_committed_index(self):
        path = ROOT / "data" / "raw" / "qavanin-index" / "qavanin-list.tsv.gz"
        if not path.exists():
            self.skipTest("فهرست عناوین موجود نیست")
        with gzip.open(path, "rt", encoding="utf-8") as f:
            header = next(f).rstrip("\n").split("\t")
            self.assertEqual(header, ["id", "title", "approval_date", "approval_authority"])
            found = {}
            for line in f:
                parts = line.rstrip("\n").split("\t")
                self.assertEqual(len(parts), 4)
                if parts[0] in ("178971", "38162", "86054"):
                    found[parts[0]] = parts
        self.assertEqual(found["178971"][1], "قانون مدني")
        self.assertEqual(found["38162"][2], "1358/09/12")
        self.assertEqual(found["86054"][1], "قانون تجارت الكترونيكي")


if __name__ == "__main__":
    unittest.main()
