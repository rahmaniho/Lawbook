import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import bs4  # noqa: F401
except ImportError as e:  # bs4 نصب نیست
    raise unittest.SkipTest(f"beautifulsoup4 لازم است: {e}")

from qavanin_playwright import law_url, parse_list_page  # noqa: E402

# نمونه ساختار جدول فهرست مصوبات صفحه اصلی سامانه (مطابق خزنده‌های متن‌باز)
HTML = """
<html><body>
<select id="PageSize"><option value="50">50</option><option value="1000">1000</option></select>
<select id="PageNumber"><option value="1">1</option><option value="2">2</option></select>
<table class="slwTable">
  <tr><th>ردیف</th><th>عنوان</th><th>تاریخ تصویب</th><th>مرجع تصویب</th></tr>
  <tr><td>1</td><td><a href="/Law/TreeText/178971">قانون   مدني</a></td><td>1314/08/08</td><td>مجلس شوراي ملي</td></tr>
  <tr><td>2</td><td><a href="/Law/TreeText/?IDS=86054">قانون تجارت الكترونيكي</a></td><td> 1382/10/17 </td><td>مجلس شوراي اسلامي</td></tr>
  <tr><td>3</td><td>بدون پیوند</td><td>1300/01/01</td><td>—</td></tr>
</table>
</body></html>
"""


class ListParserTest(unittest.TestCase):
    def test_parse_rows(self):
        rows = parse_list_page(HTML)
        self.assertEqual(
            rows,
            [
                {"id": 178971, "title": "قانون مدني", "date": "1314/08/08", "authority": "مجلس شوراي ملي"},
                {"id": 86054, "title": "قانون تجارت الكترونيكي", "date": "1382/10/17", "authority": "مجلس شوراي اسلامي"},
            ],
        )

    def test_law_url(self):
        self.assertEqual(law_url(178971), "https://qavanin.ir/Law/TreeText/178971")
        self.assertEqual(law_url(4620049716372613096), "https://qavanin.ir/Law/TreeText/?IDS=4620049716372613096")


if __name__ == "__main__":
    unittest.main()
