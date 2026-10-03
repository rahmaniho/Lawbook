import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from parse_qavanin import article_key, parse_qavanin_lines, parse_subtitle, split_segments  # noqa: E402

SAMPLE = """قانون نمونه
مصوب 1307/2/18 مجلس شورای ملی با اصلاحات و الحاقات بعدی
❯ مقدمه - در کلیات
ماده 1
متن ماده یک که به ماده 2 ارجاع می‌دهد.

❯ جلد اول - در اموال
❯ کتاب اول - در اموال
❯ باب اول - انواع اموال
ماده 2
(اصلاحی 1370/8/14) - متن اصلاحی ماده دو.
تبصره 1 - تبصره نخست.
1- بند اول تبصره
تبصره 2 (الحاقی 1381/4/29 مصوب مجمع تشخیص مصلحت نظام)- تبصره دوم.

ماده 2 مکرر
متن ماده مکرر.

❯ باب دوم - حقوق
ماده 3
به موجب قانون اصلاح موادی از قانون مدنی مصوب 1370/08/14 حذف شده است.

ماده 4
[منسوخ 1370/8/14].

❯ کتاب دوم - اسباب تملک
❯ قسمت اول - احیا
❯ باب اول - احیای اراضی
ماده 5
طبق ماده 10 قانون ثبت و مواد 1 تا 3 این قانون عمل می‌شود.
"""


class ParseTest(unittest.TestCase):
    def setUp(self):
        self.law = parse_qavanin_lines(SAMPLE.split("\n"))

    def test_header(self):
        self.assertEqual(self.law.title, "قانون نمونه")
        self.assertEqual(self.law.approval_date, "1307/02/18")
        self.assertEqual(self.law.approval_authority, "مجلس شورای ملی")
        self.assertIn("اصلاحات", self.law.approval_note)

    def test_articles(self):
        keys = [a.key for a in self.law.articles]
        self.assertEqual(keys, ["1", "2", "2-bis", "3", "4", "5"])
        a2 = self.law.articles[1]
        self.assertEqual(len(a2.notes), 2)
        self.assertIn("بند اول تبصره", a2.notes[0])
        self.assertEqual(a2.status, "اصلاحی")
        self.assertEqual([m["kind"] for m in a2.amendments], ["اصلاحی", "الحاقی"])
        self.assertEqual(a2.amendments[0]["date"], "1370/08/14")

    def test_repealed(self):
        self.assertEqual(self.law.articles[3].status, "منسوخ")
        self.assertEqual(self.law.articles[4].status, "منسوخ")

    def test_refs_skip_other_laws(self):
        a1 = self.law.articles[0]
        self.assertEqual(a1.refs, ["2"])
        a5 = self.law.articles[5]
        # «ماده 10 قانون ثبت» ارجاع خارجی است؛ «مواد 1 تا 3 این قانون» داخلی
        self.assertEqual(a5.refs, ["1", "2", "3"])

    def test_heading_tree(self):
        titles = {h.title: h for h in self.law.headings}
        intro = titles["مقدمه - در کلیات"]
        vol = titles["جلد اول - در اموال"]
        self.assertIsNone(intro.parent_id)
        self.assertIsNone(vol.parent_id, "جلد نباید زیرمجموعه مقدمه شود")
        part = titles["قسمت اول - احیا"]
        book2 = titles["کتاب دوم - اسباب تملک"]
        self.assertEqual(part.parent_id, book2.id)
        self.assertEqual(titles["باب اول - احیای اراضی"].parent_id, part.id)
        self.assertEqual(book2.parent_id, vol.id)

    def test_article_key(self):
        self.assertEqual(article_key(499, "مکرر"), "499-bis")
        self.assertEqual(article_key(10, "مکرر 2"), "10-bis2")
        self.assertEqual(parse_subtitle("مصوب 1392/02/01 مجلس شورای اسلامی")[0], "1392/02/01")


class SegmentTest(unittest.TestCase):
    def test_split(self):
        raw = "عنوان\nمصوب 1311/02/13 مجلس\n❯ باب اول - الف\nماده 1\nمتن\n❯ لایحه اصلاحی\n❯ مبحث اول - سهامی\nماده 1\nمتن لایحه\n❯ مبحث دوم - محدود\nماده 94\nمتن"
        parts = split_segments(raw, [{"id": "bill", "start": "لایحه اصلاحی", "end": "مبحث دوم"}])
        self.assertIn("❯ مبحث اول - سهامی", parts["bill"])
        self.assertNotIn("❯ لایحه اصلاحی", parts["bill"])
        self.assertIn("ماده 94", parts[None])
        self.assertNotIn("متن لایحه", parts[None])


if __name__ == "__main__":
    unittest.main()
