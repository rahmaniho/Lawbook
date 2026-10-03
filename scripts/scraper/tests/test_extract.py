import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pipeline"))

try:
    from extract import html_to_qavanin_text, plain_text_to_qavanin_text
except ImportError as e:  # bs4 نصب نیست
    raise unittest.SkipTest(f"beautifulsoup4 لازم است: {e}")

from parse_qavanin import parse_qavanin_lines  # noqa: E402

HTML = """
<html><body>
<table class="w100"><tr><td><h1>قانون تجارت الکترونیکی</h1><h3>مصوب ۱۳۸۲/۱۰/۱۷ مجلس شورای اسلامی</h3></td></tr></table>
<table class="w100"><tr><td><h2>قانون تجارت الکترونیکی</h2></td></tr></table>
<div id="treeText">
  <p class="SecTex"><span class="bold blue">باب اول - </span>در مقررات عمومی</p>
  <p class="SecTex"><span class="bold blue">مبحث اول - </span>کلیات</p>
  <p class="SecTex"><span class="bold blue">ماده ۱ - </span>این قانون مجموعه اصول و قواعدی است که برای مبادله آسان و ایمن اطلاعات به کار می‌رود.</p>
  <p class="SecTex"><span class="bold blue">ماده ۲</span></p>
  <p class="SecTex">الف - «داده پیام» هر نمادی از واقعه است.</p>
  <p class="SecTex"><span class="bold blue">تبصره ۱ - </span>متن تبصره.</p>
  <table><tr><td>ردیف</td><td>نرخ</td></tr><tr><td>۱</td><td>۱۰٪</td></tr></table>
  <p class="SecTex"><span class="bold blue">ماده ۲ مکرر - </span>متن ماده مکرر.</p>
</div></body></html>
"""


class ExtractTest(unittest.TestCase):
    def test_html_roundtrip_through_parser(self):
        text = html_to_qavanin_text(HTML)
        lines = text.split("\n")
        self.assertEqual(lines[0], "قانون تجارت الکترونیکی")
        self.assertTrue(lines[1].startswith("مصوب 1382/10/17"))
        self.assertIn("❯ باب اول - در مقررات عمومی", lines)
        self.assertIn("ماده 1", lines)
        self.assertIn("ماده 2 مکرر", lines)
        self.assertIn("ردیف | نرخ", lines)
        law = parse_qavanin_lines(lines)
        self.assertEqual([a.key for a in law.articles], ["1", "2", "2-bis"])
        self.assertEqual(law.articles[1].notes, ["تبصره 1 - متن تبصره.\nردیف | نرخ\n1 | 10٪"])
        self.assertEqual(law.approval_date, "1382/10/17")

    def test_plain_text(self):
        text = plain_text_to_qavanin_text(["فصل اول - کلیات", "ماده 1- متن یک", "تبصره - متن تبصره"], title="قانون نمونه")
        self.assertEqual(text.split("\n"), ["قانون نمونه", "❯ فصل اول - کلیات", "", "ماده 1", "متن یک", "تبصره - متن تبصره", ""])


if __name__ == "__main__":
    unittest.main()
