/**
 * نرمال‌سازی متن فارسی — هم‌ارز با scripts/pipeline/normalize_fa.py
 *
 * normalizeDisplay: تغییرات نگارشی بی‌اثر بر معنا (ی/ک عربی، کشیده، نیم‌فاصله اضافه، ارقام)
 * normalizeSearch : برای ایندکس و جستجو (حذف اعراب، یکسان‌سازی همزه‌ها و ة/ۀ، حروف کوچک)
 * tokenize/processTerm: توکن‌سازی سازگار با MiniSearch؛ واژه‌های دارای نیم‌فاصله هم به‌صورت
 * چسبیده و هم به‌صورت اجزا ایندکس می‌شوند تا «می‌شود»، «میشود» و «می شود» همگی پیدا شوند.
 */

export const ZWNJ = '\u200c'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

const DISPLAY_MAP: Record<string, string> = {
  '\u064a': '\u06cc', // ي
  '\u0649': '\u06cc', // ى
  '\u0643': '\u06a9', // ك
  '\u06c1': '\u0647', // ہ
  '\u06be': '\u0647', // ھ (های دوچشم)
  '\u0640': '', // ـ
  '\ufeff': '',
  '\u00ad': '',
  '\u200d': '',
  '\u200e': '',
  '\u200f': '',
  '\u202a': '',
  '\u202b': '',
  '\u202c': '',
  '\u202d': '',
  '\u202e': '',
  '\u2066': '',
  '\u2067': '',
  '\u2068': '',
  '\u2069': '',
  '\u00a0': ' ',
  '\u2000': ' ',
  '\u2001': ' ',
  '\u2002': ' ',
  '\u2003': ' ',
  '\u2004': ' ',
  '\u2005': ' ',
  '\u2006': ' ',
  '\u2007': ' ',
  '\u2008': ' ',
  '\u2009': ' ',
  '\u200a': ' ',
  '\u202f': ' ',
  '\u205f': ' ',
  '\u3000': ' ',
  '\t': ' ',
}

const SEARCH_MAP: Record<string, string> = {
  '\u0626': '\u06cc', // ئ
  '\u0629': '\u0647', // ة
  '\u06c0': '\u0647', // ۀ
  '\u0623': '\u0627', // أ
  '\u0625': '\u0627', // إ
  '\u0671': '\u0627', // ٱ
  '\u0622': '\u0627', // آ
  '\u0624': '\u0648', // ؤ
  '\u0621': '', // ء
}

const DISPLAY_RE = new RegExp(`[${Object.keys(DISPLAY_MAP).join('')}]`, 'g')
const SEARCH_RE = new RegExp(`[${Object.keys(SEARCH_MAP).join('')}]`, 'g')
const DIGITS_RE = /[۰-۹٠-٩]/g
const DIACRITICS_RE = /[\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e8\u06ea-\u06ed]/g
const PRESENTATION_RE = /[\ufb50-\ufdff\ufe70-\ufefc]/g
const LETTER = '[\\u0621-\\u063a\\u0641-\\u064a\\u0671-\\u06d3\\u06d5\\u06ee\\u06ef\\u06fa-\\u06fc\\u06ff]'
const BIDI_BETWEEN_LETTERS_RE = /(?<=[\u0621-\u064a\u0671-\u06d3\u06d5\u06fa-\u06ff])[\u200e\u200f](?=[\u0621-\u064a\u0671-\u06d3\u06d5\u06fa-\u06ff])/g
const PUNCT = `[\\d.,،؛:;!?؟()\\[\\]«»"'\\-]`
const MULTI_ZWNJ_RE = /\u200c{2,}/g
const ZWNJ_EDGE_RE = new RegExp(`(^\\u200c+)|(\\u200c+$)|(\\u200c+(?=${PUNCT}))|((?<=${PUNCT})\\u200c+)`, 'g')
const ZWNJ_SPACE_RE = new RegExp(`(?<=${LETTER}) *\\u200c *(?=${LETTER})`, 'g')
const ZWNJ_NEAR_SPACE_RE = /( \u200c)|(\u200c )/g
const MULTI_SPACE_RE = / {2,}/g

export function toLatinDigits(s: string): string {
  return s.replace(DIGITS_RE, (d) => {
    const i = FA_DIGITS.indexOf(d)
    return String(i >= 0 ? i : AR_DIGITS.indexOf(d))
  })
}

export function toFaDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)])
}

export function normalizeZwnj(s: string): string {
  return s
    .replace(MULTI_ZWNJ_RE, ZWNJ)
    .replace(ZWNJ_EDGE_RE, '')
    .replace(ZWNJ_SPACE_RE, ZWNJ)
    .replace(ZWNJ_NEAR_SPACE_RE, ' ')
    .replace(ZWNJ_EDGE_RE, '')
}

export function normalizeDisplay(text: string): string {
  if (!text) return ''
  let s = text.replace(/\r\n?/g, '\n')
  s = s.replace(PRESENTATION_RE, (ch) => ch.normalize('NFKC'))
  s = s.replace(BIDI_BETWEEN_LETTERS_RE, ZWNJ)
  s = s.replace(DISPLAY_RE, (ch) => DISPLAY_MAP[ch] ?? ch)
  s = toLatinDigits(s)
  return s
    .split('\n')
    .map((line) => normalizeZwnj(line).replace(MULTI_SPACE_RE, ' ').trim())
    .join('\n')
}

export function normalizeSearch(text: string): string {
  let s = normalizeDisplay(text)
  s = s.replace(DIACRITICS_RE, '')
  s = s.replace(SEARCH_RE, (ch) => SEARCH_MAP[ch] ?? ch)
  return s.toLowerCase().replace(MULTI_SPACE_RE, ' ').trim()
}

/** جداکننده‌های توکن (فاصله و علائم فارسی/لاتین) */
export const TOKEN_SPLIT_RE = /[\s\u060c\u061b\u061f\u06d4.,;:!?()[\]{}«»"'/\\\-–—_*+=<>|…٪%]+/u

/** واژه‌های بسیار پرتکرار که ارزش جستجویی ندارند */
export const STOP_WORDS = new Set(
  [
    'و',
    'در',
    'به',
    'از',
    'که',
    'این',
    'ان',
    'را',
    'با',
    'است',
    'برای',
    'یا',
    'تا',
    'بر',
    'هر',
    'می',
    'های',
    'ها',
    'خود',
    'نیز',
    'اگر',
    'چه',
    'یک',
    'شود',
    'شده',
    'باشد',
    'کند',
    'نماید',
    'گردد',
    'میشود',
    'بوده',
    'دیگر',
    'ای',
    'اند',
    'هم',
  ].map((w) => w),
)

export function tokenize(text: string): string[] {
  return normalizeSearch(text).split(TOKEN_SPLIT_RE).filter(Boolean)
}

/** پردازش هر توکن برای MiniSearch؛ آرایه برگرداندن یعنی ایندکس چند شکل از یک واژه. */
export function processTerm(term: string): string | string[] | null {
  const t = normalizeSearch(term)
  if (!t) return null
  if (t.includes(ZWNJ)) {
    const joined = t.replaceAll(ZWNJ, '')
    // اجزای تک‌حرفی (مثل «ی» در «قراردادها‌ی») ارزش جستجویی ندارند
    const parts = t.split(ZWNJ).filter((p) => p.length > 1 && !STOP_WORDS.has(p))
    const out = [joined, ...parts].filter((p) => !STOP_WORDS.has(p))
    return out.length ? [...new Set(out)] : null
  }
  if (STOP_WORDS.has(t)) return null
  return t
}

/** توکن‌های قابل جستجوی یک عبارت (برای هایلایت و پرس‌وجوی عبارتی) */
export function searchTerms(text: string): string[] {
  const out: string[] = []
  for (const tok of tokenize(text)) {
    const p = processTerm(tok)
    if (!p) continue
    if (Array.isArray(p)) out.push(...p)
    else out.push(p)
  }
  return [...new Set(out)]
}

/**
 * ساخت RegExp منعطف برای هایلایت یک واژه نرمال‌شده در متن اصلی:
 * تحمل اعراب، کشیده، نیم‌فاصله و گونه‌های حروف عربی/فارسی.
 */
const CHAR_CLASS: Record<string, string> = {
  ی: '[یيىئ]',
  ک: '[کك]',
  ا: '[اآأإٱ]',
  ه: '[هةۀ]',
  و: '[وؤ]',
  '0': '[0۰٠]',
  '1': '[1۱١]',
  '2': '[2۲٢]',
  '3': '[3۳٣]',
  '4': '[4۴٤]',
  '5': '[5۵٥]',
  '6': '[6۶٦]',
  '7': '[7۷٧]',
  '8': '[8۸٨]',
  '9': '[9۹٩]',
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function looseTermPattern(term: string): string {
  const chars = [...term].filter((c) => c !== ZWNJ)
  return chars.map((c) => CHAR_CLASS[c] ?? escapeRe(c)).join('[\\u064b-\\u065f\\u0670\\u0640\\u200c\\u0621]*')
}

export function buildHighlightRegex(terms: string[]): RegExp | null {
  const uniq = [...new Set(terms.filter((t) => t && t.length > 1))].sort((a, b) => b.length - a.length)
  if (!uniq.length) return null
  return new RegExp(`(${uniq.map(looseTermPattern).join('|')})`, 'giu')
}
