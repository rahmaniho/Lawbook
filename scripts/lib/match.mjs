/**
 * ابزار مشترکِ نرمال‌سازی و تطبیق عنوان‌ها.
 * بین اسکریپت تطبیق فهرست مرجع (verify-registry) و استخراج از منابع
 * (extract-legalchatbot) به اشتراک گذاشته می‌شود تا هر دو یک رفتار داشته باشند.
 */

/** واژه‌هایی که در تطبیق واژگانی نادیده گرفته می‌شوند */
export const STOPWORDS = new Set([
  'از', 'و', 'در', 'به', 'با', 'بر', 'برای', 'ال', 'الی', 'تا', 'یا', 'که', 'این', 'آن',
]);

/** کلید بی‌فاصله: برای یکی‌دانستن «قانون اداره تصفیه…» و «قانونادارهتصفیه…» */
export function squashKey(text) {
  return normalizeText(text).replace(/\s+/g, '');
}

/** یکسان‌سازی نویسه‌های عربی/فارسی و حذف علائم برای مقایسه */
export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u064B-\u0652\u0670\u0640\u0654\u0655\u06D6-\u06ED]/g, '')
    .replace(/[\u0622\u0623\u0625\u0627]/g, 'ا')
    .replace(/\u0649/g, 'ی')
    .replace(/\u064A/g, 'ی')
    .replace(/\u06CC/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/\u06A9/g, 'ک')
    .replace(/\u0629/g, 'ه')
    .replace(/\u0624/g, 'و')
    .replace(/\u0626/g, 'ی')
    .replace(/[\u200b-\u200f\u202a-\u202e\uFEFF]/g, '')
    .replace(/[()（）\[\]\/\\.:،؛;!؟?«»"'‌]/g, ' ')
    .replace(/[0-9]/g, (d) => String(d))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function tokenizeTitle(text) {
  return new Set(normalizeText(text).split(' ').filter((w) => w && !STOPWORDS.has(w)));
}

function subsetOf(a, b) {
  if (a.size === 0) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
}

/**
 * تطبیق یک عنوان با فهرستی از رکوردها.
 * ترتیب قوانین: عنوان دقیق ← هم‌ارزی اعلام‌شده ← زیررشته ← تطبیق واژگانی.
 *
 * @param {string} title عنوان مورد جست‌وجو
 * @param {Array} records رکوردهای موجود
 * @param {(rec: any) => string} getTitle استخراج عنوان از رکورد
 * @param {{ aliases?: Record<string,string>, idOf?: (rec:any)=>string }} options
 */
export function findTitleMatch(title, records, getTitle, options = {}) {
  const { aliases = {}, idOf = (r) => r.id } = options;
  const n = normalizeText(title);
  if (!n) return null;

  for (const rec of records) {
    if (normalizeText(getTitle(rec)) === n) return { rec, rule: 'عنوان دقیق' };
  }
  /* برابریِ بدون فاصله — برای عناوین چسبیده/جدانویسی‌شدهٔ منبع */
  const sq = squashKey(n);
  if (sq) {
    for (const rec of records) {
      if (squashKey(getTitle(rec)) === sq) return { rec, rule: 'عنوان یکسان (بدون فاصله)' };
    }
  }
  const aliasId = aliases[title];
  if (aliasId) {
    const rec = records.find((r) => idOf(r) === aliasId);
    if (rec) return { rec, rule: 'هم‌ارز اعلام‌شده' };
  }
  for (const rec of records) {
    const rn = normalizeText(getTitle(rec));
    if (rn && (rn.includes(n) || n.includes(rn))) return { rec, rule: 'تطبیق زیررشته‌ای' };
  }
  const w = tokenizeTitle(title);
  for (const rec of records) {
    const rw = tokenizeTitle(getTitle(rec));
    if (subsetOf(w, rw) || subsetOf(rw, w)) return { rec, rule: 'تطبیق واژگانی' };
  }
  return null;
}
