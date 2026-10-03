"""
نرمال‌سازی متن فارسی برای «کتابچه قانون»

دو سطح نرمال‌سازی داریم:

1. normalize_display(text): برای ذخیره و نمایش متن قانون.
   فقط تغییرات «نگارشی» که معنای حقوقی را تغییر نمی‌دهند:
   - تبدیل حروف عربی «ي/ى/ك» به «ی/ک»
   - تبدیل Presentation Formهای عربی (خروجی PDF) به حروف استاندارد
   - حذف کشیده (ـ)، کاراکترهای کنترلی جهت‌نما، BOM و فاصله‌های غیراستاندارد
   - اصلاح نیم‌فاصله‌های اضافه/تکراری (مثلاً «نهضت‌ های» ← «نهضت‌های»)
   - تبدیل ارقام فارسی/عربی به لاتین (نمایش فارسی در لایه رابط کاربری انجام می‌شود)

2. normalize_search(text): برای ایندکس و جستجو (تهاجمی‌تر):
   - همه موارد بالا + حذف اعراب، یکسان‌سازی همزه‌ها و «ة/ۀ»، حروف کوچک لاتین

این قواعد عیناً در src/lib/normalize.ts پیاده شده‌اند؛ هر تغییری باید در هر دو فایل
اعمال و با تست‌ها (scripts/pipeline/tests و src/lib/__tests__) بررسی شود.
"""

from __future__ import annotations

import re
import unicodedata

ZWNJ = "\u200c"

# --- جدول‌های نگاشت -------------------------------------------------------

_DIGITS_TO_LATIN = str.maketrans(
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)
_DIGITS_TO_FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

_DISPLAY_CHAR_MAP = str.maketrans(
    {
        "\u064a": "\u06cc",  # ي → ی
        "\u0649": "\u06cc",  # ى → ی
        "\u0643": "\u06a9",  # ك → ک
        "\u06c1": "\u0647",  # ہ → ه
        "\u0640": None,  # ـ کشیده
        "\ufeff": None,  # BOM
        "\u00ad": None,  # soft hyphen
        "\u200d": None,  # ZWJ
        "\u200e": None,  # LRM
        "\u200f": None,  # RLM
        "\u202a": None,
        "\u202b": None,
        "\u202c": None,
        "\u202d": None,
        "\u202e": None,
        "\u2066": None,
        "\u2067": None,
        "\u2068": None,
        "\u2069": None,
        "\u00a0": " ",
        "\u2000": " ",
        "\u2001": " ",
        "\u2002": " ",
        "\u2003": " ",
        "\u2004": " ",
        "\u2005": " ",
        "\u2006": " ",
        "\u2007": " ",
        "\u2008": " ",
        "\u2009": " ",
        "\u200a": " ",
        "\u202f": " ",
        "\u205f": " ",
        "\u3000": " ",
        "\t": " ",
    }
)

_SEARCH_CHAR_MAP = str.maketrans(
    {
        "\u0626": "\u06cc",  # ئ → ی
        "\u0629": "\u0647",  # ة → ه
        "\u06c0": "\u0647",  # ۀ → ه
        "\u0623": "\u0627",  # أ → ا
        "\u0625": "\u0627",  # إ → ا
        "\u0671": "\u0627",  # ٱ → ا
        "\u0622": "\u0627",  # آ → ا
        "\u0624": "\u0648",  # ؤ → و
        "\u0621": None,  # ء
    }
)

# اعراب و علائم قرآنی
_DIACRITICS_RE = re.compile("[\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e8\u06ea-\u06ed]")

# Presentation Forms-A و B (خروجی PDF)
_PRESENTATION_RE = re.compile("[\ufb50-\ufdff\ufe70-\ufefc]")

_MULTI_SPACE_RE = re.compile(" {2,}")
_MULTI_ZWNJ_RE = re.compile(ZWNJ + "{2,}")
# حروف الفبای عربی/فارسی (برای تصمیم درباره نیم‌فاصله)
_LETTER = "[\u0621-\u063a\u0641-\u064a\u0671-\u06d3\u06d5\u06ee\u06ef\u06fa-\u06fc\u06ff]"
# نیم‌فاصله چسبیده به فاصله میان دو حرف: «نهضت‌ های» یا «جامع ‌الشرایط» ← نیم‌فاصله
_ZWNJ_SPACE_RE = re.compile("(?<=" + _LETTER + ") *" + ZWNJ + " *(?=" + _LETTER + ")")
# نیم‌فاصلهٔ باقی‌مانده کنار فاصله بی‌اثر است
_ZWNJ_NEAR_SPACE_RE = re.compile("( " + ZWNJ + ")|(" + ZWNJ + " )")
# نیم‌فاصله در ابتدای/انتهای رشته یا کنار علائم و ارقام بی‌اثر است
_PUNCT_CLASS = r"[\d.,،؛:;!?؟()\[\]«»\"'\-]"
_ZWNJ_EDGE_RE = re.compile(
    "(^" + ZWNJ + "+)|(" + ZWNJ + "+$)|(" + ZWNJ + "+(?=" + _PUNCT_CLASS + "))|((?<=" + _PUNCT_CLASS + ")" + ZWNJ + "+)"
)


def _presentation_to_standard(match: re.Match) -> str:
    return unicodedata.normalize("NFKC", match.group(0))


def to_latin_digits(text: str) -> str:
    return text.translate(_DIGITS_TO_LATIN)


def to_fa_digits(text: str) -> str:
    return text.translate(_DIGITS_TO_FA)


def normalize_zwnj(text: str) -> str:
    text = _MULTI_ZWNJ_RE.sub(ZWNJ, text)
    # ابتدا نیم‌فاصلهٔ کنار ارقام/علائم حذف شود («ماده ‌425» ← «ماده 425»)
    text = _ZWNJ_EDGE_RE.sub("", text)
    # سپس ترکیب فاصله و نیم‌فاصله به نیم‌فاصله تبدیل شود («نهضت‌ های» ← «نهضت‌های»)
    text = _ZWNJ_SPACE_RE.sub(ZWNJ, text)
    text = _ZWNJ_NEAR_SPACE_RE.sub(" ", text)
    text = _ZWNJ_EDGE_RE.sub("", text)
    return text


_BIDI_BETWEEN_LETTERS_RE = re.compile("(?<=" + "[\u0621-\u064a\u0671-\u06d3\u06d5\u06fa-\u06ff]" + ")[\u200e\u200f](?=[\u0621-\u064a\u0671-\u06d3\u06d5\u06fa-\u06ff])")


def normalize_display(text: str) -> str:
    """نرمال‌سازی محافظه‌کارانه برای ذخیره/نمایش (یک خط یا چند خط)."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _PRESENTATION_RE.sub(_presentation_to_standard, text)
    # LRM/RLM که به‌اشتباه به‌جای نیم‌فاصله میان دو حرف آمده (مثلاً «رایانه‎ای»)
    text = _BIDI_BETWEEN_LETTERS_RE.sub(ZWNJ, text)
    text = text.translate(_DISPLAY_CHAR_MAP)
    text = to_latin_digits(text)
    lines = []
    for line in text.split("\n"):
        line = normalize_zwnj(line)
        line = _MULTI_SPACE_RE.sub(" ", line).strip()
        lines.append(line)
    return "\n".join(lines)


def normalize_search(text: str) -> str:
    """نرمال‌سازی تهاجمی برای ایندکس/جستجو. نیم‌فاصله حفظ می‌شود تا توکنایزر تصمیم بگیرد."""
    text = normalize_display(text)
    text = _DIACRITICS_RE.sub("", text)
    text = text.translate(_SEARCH_CHAR_MAP)
    text = text.lower()
    text = _MULTI_SPACE_RE.sub(" ", text)
    return text.strip()


_TOKEN_SPLIT_RE = re.compile(r"[\s\u060c\u061b\u061f\u06d4.,;:!?()\[\]{}«»\"'/\\\-–—_*+=<>|…٪%]+")


def tokenize_search(text: str) -> list[str]:
    """توکن‌سازی هم‌ارز با توکنایزر سمت کلاینت (MiniSearch)."""
    out: list[str] = []
    for token in _TOKEN_SPLIT_RE.split(normalize_search(text)):
        if not token:
            continue
        if ZWNJ in token:
            joined = token.replace(ZWNJ, "")
            out.append(joined)
            out.extend(p for p in token.split(ZWNJ) if len(p) > 1)
        else:
            out.append(token)
    return out


if __name__ == "__main__":  # نمونه اجرا
    import sys

    for arg in sys.argv[1:] or ["نهضت‌ های  ايران ‌ها ١٣٧٠ ﻣﺼﻮﺑﺎت"]:
        print(normalize_display(arg))
        print(normalize_search(arg))
        print(tokenize_search(arg))
