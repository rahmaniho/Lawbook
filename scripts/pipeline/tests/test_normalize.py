import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from normalize_fa import normalize_display, normalize_search, to_fa_digits, to_latin_digits, tokenize_search  # noqa: E402

ZWNJ = "\u200c"


class NormalizeDisplayTest(unittest.TestCase):
    def test_arabic_letters(self):
        self.assertEqual(normalize_display("قانون مدني كشور"), "قانون مدنی کشور")

    def test_digits(self):
        self.assertEqual(normalize_display("ماده ۱۰ و ٢٣"), "ماده 10 و 23")
        self.assertEqual(to_fa_digits("1405"), "۱۴۰۵")
        self.assertEqual(to_latin_digits("۱۴۰۵"), "1405")

    def test_zwnj(self):
        self.assertEqual(normalize_display(f"نهضت{ZWNJ} های ایران"), f"نهضت{ZWNJ}های ایران")
        self.assertEqual(normalize_display(f"پایه{ZWNJ}{ZWNJ} های"), f"پایه{ZWNJ}های")
        self.assertEqual(normalize_display(f"ماده {ZWNJ}425"), "ماده 425")
        self.assertEqual(normalize_display(f"{ZWNJ}در مورد"), "در مورد")
        self.assertEqual(normalize_display(f"کلمه {ZWNJ}{ZWNJ} (شرکت)"), "کلمه (شرکت)")

    def test_presentation_forms_and_tatweel(self):
        self.assertEqual(normalize_display("ﻣﺼﻮﺑﺎت"), "مصوبات")
        self.assertEqual(normalize_display("قـــانون"), "قانون")

    def test_lrm_between_letters(self):
        self.assertEqual(normalize_display("رایانه\u200eای"), f"رایانه{ZWNJ}ای")


class NormalizeSearchTest(unittest.TestCase):
    def test_diacritics_and_hamza(self):
        self.assertEqual(normalize_search("مَهریّة"), "مهریه")
        self.assertEqual(normalize_search("أصل إبطال آیین"), "اصل ابطال ایین")

    def test_tokenize_zwnj(self):
        self.assertEqual(tokenize_search(f"قراردادها{ZWNJ}ی خصوصی"), ["قراردادهای", "قراردادها", "خصوصی"])


if __name__ == "__main__":
    unittest.main()
