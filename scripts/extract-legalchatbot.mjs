#!/usr/bin/env node
/**
 * استخراج داده‌های تازه از مجموعهٔ پژوهشی HamedJahantigh-git/legal_chatbot (MIT).
 *
 *   node scripts/extract-legalchatbot.mjs
 *
 * خروجی:
 *   data/curated/law-title-index.json   عناوین قوانینی که در برنامه نبوده‌اند (بدون متن)
 *   data/curated/entities-extra.json    گروه نهادی تازه (شوراها، ستادها و مراجع صادرکننده)
 *
 * اسکریپت idempotent است؛ هر بار همان خروجی را می‌سازد.
 * مجموعهٔ آراء قضایی (case.csv) در مرحلهٔ ساخت داده پردازش می‌شود و اینجا نیازی به آن نیست.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeText, tokenizeTitle, findTitleMatch } from './lib/match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'sources', 'legalchatbot');
const CURATED = path.join(ROOT, 'data', 'curated');

const readLines = (file) =>
  fs
    .readFileSync(path.join(SRC, file), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r/g, '').trim())
    .filter(Boolean);

/* ------------------------------------------------------------------ *
 * ۱) فهرست عناوین قوانین
 * ------------------------------------------------------------------ */

/** پیشوندهایی که نشان می‌دهد این خط واقعاً عنوان یک سند حقوقی است */
const DOC_PREFIXES = [
  'قانون', 'لايحه', 'لایحه', 'آيين', 'آیین', 'اساسنامه', 'تصويب', 'تصویب',
  'ماده', 'اصلاحيه', 'اصلاحیه', 'بخشنامه', 'دستورالعمل', 'نظامنامه', 'نظام‌نامه',
  'آييننامه', 'آیین نامه', 'شيوهنامه', 'شیوه‌نامه',
];

/**
 * منبع از املای غیررسمی (نبودِ «آ») استفاده می‌کند: «اموزش» به‌جای «آموزش».
 * این نگاشتِ محدود فقط روی واژه‌های کامل اعمال می‌شود تا عنوان دست‌نخورده بماند.
 */
const ALEF_EXACT = new Set([
  'اب', 'ابه', 'ابها', 'ابهای', 'انها', 'انکه', 'انچه', 'اورده', 'اورد', 'اوردن',
  'اورند', 'اوردهاند', 'اثار', 'اسایش', 'اسیب', 'اقا', 'اقای', 'اقایان', 'اینده',
  'اتش', 'امار', 'ارام', 'اداب', 'اسب', 'ابادان', 'اخوند',
]);
const ALEF_PREFIX = ['اموزش', 'ازاد', 'اباد', 'ائین', 'ایین', 'اسایش', 'اسباب'];

function fixAlefMissing(token) {
  if (ALEF_EXACT.has(token)) return `آ${token.slice(1)}`;
  for (const p of ALEF_PREFIX) {
    if (token.startsWith(p)) return `آ${token.slice(1)}`;
  }
  return token;
}

function cleanLawTitle(raw) {
  let t = raw
    .replace(/\s+/g, ' ')
    .replace(/\u064A/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u0622\u0623\u0625]/g, 'ا')
    .replace(/\s+([،؛:.])/g, '$1')
    .replace(/([،؛])(?=\S)/g, '$1 ')
    .replace(/اموز/g, 'آموز')
    .trim();
  t = t.replace(/^(ماده\s*واحده|ماده\s*الحاقی)\s*/, '$1 ');
  t = t.replace(/\s*[-–]\s*$/, '').trim();
  t = t
    .split(' ')
    .map((w) => fixAlefMissing(w))
    .join(' ');
  /* جدانویسی پیشوندهای چسبیدهٔ پرسامد (منبع گاهی بی‌فاصله نوشته است) */
  t = t.replace(/^(قانون|لایحه|اصلاحیه|بخشنامه|دستورالعمل|اساسنامه|تصویب‌نامه|آیین‌نامه|شیوه‌نامه|نظام‌نامه)(?=[\u0600-\u06FF])/, '$1 ');

  /* یکسان‌سازی دیکتهٔ «آیین» و پیوستن واژه‌های نیم‌فاصله‌ای پرسامد */
  return t
    .replace(/(آئین|ائین|ايين|آيين|ایین)/g, 'آیین')
    .replace(/آیین[\s\u200c]*نامه/g, 'آیین‌نامه')
    .replace(/تصویب[\s\u200c]*نامه/g, 'تصویب‌نامه')
    .replace(/شیوه[\s\u200c]*نامه/g, 'شیوه‌نامه')
    .replace(/نظام[\s\u200c]*نامه/g, 'نظام‌نامه')
    .trim();
}

/** کلید تطبیق: نرمال‌شده و بدون هیچ فاصله‌ای (برای یکی‌کردن «چاه های اب» و «چاههای اب») */
function squashKey(text) {
  return normalizeText(text).replace(/\s+/g, '');
}

/** واژه‌های مشترکِ دو عنوان (بدون ایست‌واژه) — برای تشخیص تکرارهای نزدیک */
function wordSet(text) {
  return tokenizeTitle(text);
}

function containsSet(a, b) {
  if (!a.size || !b.size) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
}

/** حذف تکرارهای نزدیک درون یک فهرست عنوان (بدون تغییر معنا) */
function dedupeTitles(titles) {
  const kept = [];
  for (const title of titles) {
    const key = squashKey(title);
    const words = wordSet(title);
    const dup = kept.find((k) => k.key === key || containsSet(words, k.words) || containsSet(k.words, words));
    if (dup) continue;
    kept.push({ title, key, words });
  }
  return kept.map((k) => k.title);
}

function extractLawTitles(existingLaws) {
  const raw = readLines('law_clean_list.txt');
  const seen = new Map(); // کلید نرمال‌شده → عنوان تمیز
  let duplicates = 0;
  let rejected = 0;

  for (const line of raw) {
    const title = cleanLawTitle(line);
    const key = squashKey(title);
    if (key.length < 8) { rejected++; continue; }
    if (!title.includes(' ')) { rejected++; continue; } // عناوین چسبیده/ناقص
    const firstWord = title.split(' ')[0];
    if (!DOC_PREFIXES.some((p) => normalizeText(firstWord).startsWith(normalizeText(p).split(' ')[0]))) {
      rejected++;
      continue;
    }
    if (seen.has(key)) { duplicates++; continue; }
    seen.set(key, title);
  }

  // حذف مواردی که از قبل در برنامه هستند
  const candidates = [];
  const already = [];
  for (const [, title] of seen) {
    const hit = findTitleMatch(title, existingLaws, (l) => l.title);
    if (hit) already.push({ title, matched: hit.rec.title, rule: hit.rule });
    else candidates.push(title);
  }

  // حذف تکرارهای نزدیک درون خود فهرست
  let internalDupes = 0;
  const before = candidates.length;
  const fresh = dedupeTitles(candidates);
  internalDupes = before - fresh.length;

  return {
    fresh: fresh.sort((a, b) => a.localeCompare(b, 'fa')),
    already,
    duplicates,
    internalDupes,
    rejected,
    total: raw.length,
  };
}

/* ------------------------------------------------------------------ *
 * ۲) فهرست نهادها / مراجع صادرکننده
 * ------------------------------------------------------------------ */

/** پیشوندهای نقش‌محور (شخص یا سمت) که نهاد به‌حساب نمی‌آیند */
const ROLE_PREFIXES = [
  'رئيس', 'رييس', 'رییس', 'رئیس', 'وزير', 'وزیر', 'معاون', 'دبير', 'دبیر',
  'قائم', 'نماينده', 'نماینده', 'مدير', 'مدیر', 'سرپرست', 'مشاور', 'قاضی', 'قاضي',
  'امام', 'نخست', 'فرمانده', 'نمایندگان', 'نمايندگان', 'وزرای', 'وزراى', 'وزراي',
  'پادشاه', 'اعضای', 'اعضاى', 'هيأت رئيسه', 'رؤسا', 'رؤسای',
];

/** واژه‌های عمومی که به‌تنهایی نهاد نیستند */
const GENERIC_TERMS = new Set([
  'دستگاههای اجرایی', 'دستگاه‌های اجرایی', 'کارمندان', 'موسسات', 'مؤسسات', 'دادگاه',
  'دادگاه ها', 'دادگاهها', 'کارفرما', 'کارگزاران', 'ثبت احوال', 'دبیرخانه', 'دفتر',
  'دیوان', 'ریاست', 'ستاد', 'سازمان', 'وزارت', 'قوه', 'نهاد', 'شوراي عالي', 'شورای عالی',
  'قرارگاه', 'ارتش', 'دانشگاه', 'فرهنگستان', 'کارگروه', 'کمیته', 'گمرک', 'مجلس',
  'کمیسیون حقوقی', 'مجمع', 'کمیته ملی المپیک', 'هیات', 'هیأت', 'كميسيون',
  'بانک ها', 'بانکها', 'احصائیه امور قضائی', 'اداره کل', 'اداره', 'اشخاص', 'اصناف',
]);

const ORG_CANON = [
  [/هیئت|هيئة|هيئت/g, 'هیات'],
  [/مؤسسه|موسسه/g, 'موسسه'],
  [/مسئول/g, 'مسوول'],
  [/تأمین/g, 'تامین'],
  [/ك/g, 'ک'],
];

function cleanOrg(raw) {
  let out = raw;
  for (const [re, to] of ORG_CANON) out = out.replace(re, to);
  return out
    .replace(/\s+/g, ' ')
    .replace(/\u064A/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u0622\u0623\u0625]/g, 'ا')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/[\s\u00a0]+$/, '')
    .trim();
}

function extractOrgs(existingEntities) {
  const raw = readLines('orgs.txt');
  const seen = new Map();
  let rejected = 0;
  let duplicates = 0;

  for (const line of raw) {
    const title = cleanOrg(line);
    const key = squashKey(title);
    if (key.length < 6) { rejected++; continue; }
    const words = title.split(' ').filter(Boolean);
    if (words.length < 2) { rejected++; continue; } // واژه‌های عمومی تک‌کلمه‌ای
    if (GENERIC_TERMS.has(key)) { rejected++; continue; }
    if (ROLE_PREFIXES.some((p) => key.startsWith(normalizeText(p)))) { rejected++; continue; }
    if (seen.has(key)) { duplicates++; continue; }
    seen.set(key, title);
  }

  const candidates = [];
  const already = [];
  for (const [, title] of seen) {
    const hit = findTitleMatch(title, existingEntities, (e) => e.title);
    if (hit) already.push({ title, matched: hit.rec.title, rule: hit.rule });
    else candidates.push(title);
  }
  const fresh = dedupeTitles(candidates);
  const internalDupes = candidates.length - fresh.length;

  return {
    fresh: fresh.sort((a, b) => a.localeCompare(b, 'fa')),
    already,
    duplicates,
    internalDupes,
    rejected,
    total: raw.length,
  };
}

/* ------------------------------------------------------------------ *
 * اجرا
 * ------------------------------------------------------------------ */
function main() {
  const catalog = JSON.parse(fs.readFileSync(path.join(CURATED, 'catalog.json'), 'utf8'));
  const referenceLaws = JSON.parse(fs.readFileSync(path.join(CURATED, 'reference-laws.json'), 'utf8'));
  const entities = JSON.parse(fs.readFileSync(path.join(CURATED, 'entities.json'), 'utf8'));

  const existingLaws = [...catalog.laws, ...referenceLaws.laws];
  const existingEntities = entities.groups.flatMap((g) => g.items);

  /* ---- عناوین قوانین ---- */
  const laws = extractLawTitles(existingLaws);
  const lawDocs = laws.fresh.map((title, i) => {
    const docType = guessDocumentType(title);
    const category = guessCategory(title);
    const categoryTitle = CATEGORY_TITLES[category] || 'سایر';
    return {
    id: `title-index-${String(i + 1).padStart(3, '0')}`,
    title,
    shortTitle: title.length > 60 ? `${title.slice(0, 58)}…` : title,
    category,
    hierarchy: guessHierarchy(title),
    documentType: docType,
    summary: `تنها عنوان این ${docType} از فهرست منابع حقوقی استخراج شده است و متن ماده‌های آن در منابع در دسترس نبوده است. دستهٔ موضوعی: ${categoryTitle}.`,
    origin: 'law-title-index',
    keywords: [...tokenizeTitle(title)].slice(0, 8),
    };
  });

  fs.writeFileSync(
    path.join(CURATED, 'law-title-index.json'),
    `${JSON.stringify(
      {
        $schema: './reference-laws.schema.md',
        _note: 'عناوین قوانین و مقررات استخراج‌شده از فهرست منبع پژوهشی legal_chatbot (MIT). این مدخل‌ها فقط عنوان سند را دارند و متن ماده‌ها برای آن‌ها موجود نیست.',
        source: {
          name: 'فهرست عناوین — HamedJahantigh-git/legal_chatbot (MIT)',
          url: 'https://github.com/HamedJahantigh-git/legal_chatbot',
        },
        laws: lawDocs,
      },
      null,
      1,
    )}\n`,
    'utf8',
  );

  /* ---- نهادها ---- */
  const orgs = extractOrgs(existingEntities);
  fs.writeFileSync(
    path.join(CURATED, 'entities-extra.json'),
    `${JSON.stringify(
      {
        $schema: './entities.schema.md',
        _note: 'شوراها، ستادها و مراجع صادرکننده/مخاطب اسناد حقوقی، استخراج‌شده از فهرست منبع پژوهشی legal_chatbot (MIT). این فهرست از فرادادهٔ اسناد به‌دست آمده و ممکن است شامل نام‌های تاریخی یا ترکیبی باشد.',
        groups: [
          {
            id: 'councils-and-authorities',
            title: 'شوراها، ستادها و مراجع صادرکننده',
            icon: 'Users',
            color: '#0e7490',
            order: 9,
            description:
              'مراجع، شوراها و ستادهایی که در اسناد حقوقی ایران به‌عنوان صادرکننده یا مخاطب آمده‌اند (استخراج‌شده از فرادادهٔ اسناد)',
            items: orgs.fresh.map((title, i) => ({
              id: `authority-${String(i + 1).padStart(3, '0')}`,
              title,
              shortTitle: title.length > 50 ? `${title.slice(0, 48)}…` : title,
            })),
          },
        ],
      },
      null,
      1,
    )}\n`,
    'utf8',
  );

  console.log('\n🧩 استخراج از legal_chatbot\n');
  console.log(`   عناوین قوانین: ${laws.total} خط → ${laws.fresh.length} عنوان تازه | ${laws.already.length} تکراری با برنامه | ${laws.internalDupes} تکراری نزدیک | ${laws.rejected} ردشده`);
  console.log(`   نهادها: ${orgs.total} خط → ${orgs.fresh.length} نهاد تازه | ${orgs.already.length} تکراری با برنامه | ${orgs.internalDupes} تکراری نزدیک | ${orgs.rejected} ردشده`);
  console.log('\n   خروجی: data/curated/law-title-index.json و data/curated/entities-extra.json\n');
}

/* ------------------------------------------------------------------ *
 * حدس دسته و سلسله‌مراتب از روی عنوان
 * ------------------------------------------------------------------ */
const CATEGORY_RULES = [
  [/مجازات|کیفری|جرایم|جرائم|جرم|تعزیر|قصاص|دیات|حدود|زندان|حبس|مواد مخدر|پول.?شویی|ارتشاء|اختلاس|کلاهبرداری|رشوه/, 'keyfari'],
  [/آیین دادرسی|آئین دادرسی|دادرسی|اجرای احکام|شورای? حل اختلاف|داوری|دادگاه|محکومیت|وکالت|قضاوت|دیوان عالی/, 'aein'],
  [/تجارت|شرکتهای?|ورشکستگی|چک|اسناد تجاری|بورس|اوراق بهادار|بیمه|گمرک|صادرات|واردات|قراردادهای? بازرگانی|صنفی|تجاری/, 'tejarat'],
  [/مالیات|عوارض|درآمدهای? دولت|بودجه|خزانه|بانک|پولی|ارز|مؤدیان|مودیان|فروشگاهی/, 'mali'],
  [/کار|کارگر|تأمین اجتماعی|تامین اجتماعی|بیمه.?های اجتماعی|استخدام|خدمات کشوری|بازنشستگی|مزد|رفاه|تعاون|اشتغال/, 'kar'],
  [/نکاح|خانواده|طلاق|حضانت|نفقه|ازدواج|فرزند|جوانی جمعیت|جمعیت/, 'khanevade'],
  [/مدنی|مالکیت|اموال|ارث|وصیت|وقف|اجاره|موجر|مستاجر|مستأجر|آپارتمان|ثبت اسناد|سند رسمی|حدنگار|کاداستر|تعهدات|مسئولیت مدنی/, 'madani'],
  [/وزارت|شهرداری|شورا|اداری|دیوان عدالت|تخلفات اداری|نظام اداری|استخدام کشوری|مدیریت خدمات|برنامه توسعه|انتخابات|احزاب|مطبوعات/, 'edari'],
  [/اساسی|قانون اساسی|شورای نگهبان|مجمع تشخیص|رهبری|حقوق ملت|کنوانسیون|میثاق|حقوق بشر|کودک|معلولیت/, 'asasi'],
];

/** عنوان فارسی دسته‌ها (برای نوشتن خلاصهٔ خودکار) */
const CATEGORY_TITLES = {
  asasi: 'حقوق اساسی',
  madani: 'حقوق مدنی',
  keyfari: 'حقوق کیفری',
  aein: 'آیین دادرسی',
  kar: 'حقوق کار',
  tejarat: 'حقوق تجارت',
  mali: 'مالی و مالیاتی',
  edari: 'حقوق اداری',
  khanevade: 'خانواده',
  sayer: 'سایر',
};

function guessCategory(title) {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(title)) return cat;
  return 'sayer';
}

function guessHierarchy(title) {
  if (/^(آیین|آيين)[\s\u200c]*نامه|^(تصویب|تصويب)[\s\u200c]*نامه|^بخشنامه|^دستورالعمل|^(شیوه|شيوه|نظام)[\s\u200c]*نامه/.test(title)) {
    return 'regulation';
  }
  if (/^اساسنامه/.test(title)) return 'regulation';
  if (/^لایحه|^لايحه/.test(title)) return 'statute';
  if (/کنوانسیون|میثاق|معاهده|پروتکل/.test(title)) return 'treaty';
  return 'statute';
}

function guessDocumentType(title) {
  if (/^(آیین|آيين)[\s\u200c]*نامه/.test(title)) return 'آیین‌نامه';
  if (/^(تصویب|تصويب)[\s\u200c]*نامه/.test(title)) return 'تصویب‌نامه';
  if (/^بخشنامه/.test(title)) return 'بخشنامه';
  if (/^دستورالعمل/.test(title)) return 'دستورالعمل';
  if (/^اساسنامه/.test(title)) return 'اساسنامه';
  if (/^لایحه|^لايحه/.test(title)) return 'لایحه قانونی';
  if (/کنوانسیون|میثاق/.test(title)) return 'معاهده بین‌المللی';
  if (/^ماده/.test(title)) return 'ماده واحده';
  return 'قانون';
}

main();
