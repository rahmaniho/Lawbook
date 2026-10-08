#!/usr/bin/env node
/**
 * ساخت داده‌های «کتابچه قانون».
 *
 *   data/curated/*.json  +  data/sources/**  →  public/data/v<version>/**
 *
 * خروجی:
 *   public/data/version.json                 ← اشاره‌گر نسخه + هش هر قانون (برای به‌روزرسانی دلتا)
 *   public/data/v<version>/catalog.json      ← فهرست قوانین، دسته‌ها، سلسله‌مراتب، چک‌لیست
 *   public/data/v<version>/laws/<id>.json    ← مواد هر قانون
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseLawText, parseHubJson, parseConstitutionYaml, normalizeArticle,
  writeJson, ensureDir, sha256,
} from './lib/parse.mjs';
import { clean, toFaDigits, dateToSort, parseDocHeader } from './lib/fa.mjs';
import { buildCases } from './build-cases.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CURATED = path.join(ROOT, 'data', 'curated');
const SOURCES = path.join(ROOT, 'data', 'sources');
const PUBLIC = path.join(ROOT, 'public');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readText = (p) => fs.readFileSync(p, 'utf8');
/** خواندن یک فایلِ اختیاریِ دستی؛ اگر نبود، مقدار جایگزین برگردانده می‌شود */
const readJsonMaybe = (p, fallback) => (fs.existsSync(p) ? readJson(p) : fallback);

/* ---------------------------------------------------------------- *
 * ساخت یک سند قانون از منبع مربوطه
 * ---------------------------------------------------------------- */
function buildFromCorpus(law) {
  const file = path.join(SOURCES, 'lawcorpus', law.source.file);
  if (!fs.existsSync(file)) throw new Error(`منبع یافت نشد: ${file}`);
  const { meta, articles } = parseLawText(readText(file));
  return { meta, articles, sourceName: 'مجموعه متون قوانین (پاک‌سازی‌شده)' };
}

function buildFromHub(law) {
  const file = path.join(SOURCES, 'iranlegalhub', law.source.file);
  if (!fs.existsSync(file)) throw new Error(`منبع یافت نشد: ${file}`);
  const { meta, articles } = parseHubJson(readText(file));
  return { meta, articles, sourceName: 'IranLegalHUB (MIT)' };
}

function buildConstitution(law) {
  const yamlFile = path.join(SOURCES, 'iranconstitution', 'constitution.yaml');
  let articles = [];
  if (fs.existsSync(yamlFile)) {
    articles = parseConstitutionYaml(readText(yamlFile)).articles;
  }
  if (articles.length < 170) {
    // پشتیبان: متن قانون اساسی از مجموعه متون پاک‌سازی‌شده
    const raw = readText(path.join(SOURCES, 'lawcorpus', 'q0.txt')).replace(/\r\n/g, '\n');
    const lines = clean(raw).split('\n');
    articles = [];
    let current = null;
    const flush = () => {
      if (current) {
        current.text = current.buf.join('\n').trim();
        delete current.buf;
        if (current.text) articles.push(current);
      }
      current = null;
    };
    let section = '';
    for (const line of lines) {
      const sec = line.match(/^\s*❯+\s*(.+)$/);
      if (sec) { flush(); section = clean(sec[1]); continue; }
      const art = line.match(/^\s*اصل\s*([0-9۰-۹]+)\s*$/);
      if (art) {
        flush();
        current = { number: Number(toFaDigits(art[1]).replace(/[^0-9]/g, '')), mokarrar: false, path: section ? [section] : [], buf: [] };
        continue;
      }
      if (current) current.buf.push(line);
    }
    flush();
  }
  return {
    meta: { title: 'قانون اساسی جمهوری اسلامی ایران', note: 'مصوب ۱۳۵۸/۰۹/۱۲ با اصلاحات ۱۳۶۸', articleRange: 'مقدمه و اصول ۱ تا ۱۷۷' },
    articles,
    sourceName: 'iranconstitution (CC-BY 4.0)',
  };
}

/**
 * سند «ارجاعی» (بدون متن ماده‌ها):
 * برای قوانینی که در فهرست مرجع هستند اما متن رسمی آن‌ها هنوز در منابع پروژه
 * موجود نیست. فقط شناسنامه سند ساخته می‌شود و هیچ ماده‌ای تولید نمی‌شود.
 */
function buildReference(law, registrySource) {
  return {
    meta: {
      title: law.title,
      note: law.note || 'متن ماده‌به‌ماده این سند در منابع آزاد پروژه موجود نیست؛ برای استناد به سامانه ملی قوانین مراجعه شود.',
      articleRange: '',
    },
    articles: [],
    sourceName: law.source?.name || registrySource.name || 'فهرست مرجع',
  };
}

function buildFromCurated(law) {
  const file = path.join(CURATED, law.source.file);
  const data = readJson(file);
  const articles = data.rules.map((r) => ({
    number: r.number,
    mokarrar: false,
    path: ['قواعد فقهی بنیادین'],
    label: r.title,
    text: [
      r.statement,
      `مفهوم و کاربرد: ${r.meaning}`,
      `مستند: ${r.basis}`,
      r.applications?.length ? `موارد کاربرد: ${r.applications.join('؛ ')}` : '',
      r.caution ? `نکته: ${r.caution}` : '',
    ].filter(Boolean).join('\n'),
    _rule: r,
  }));
  return {
    meta: { title: data.title, note: data.note, articleRange: `۱ تا ${data.rules.length}` },
    articles,
    sourceName: 'تدوین کارن سافت — با بازبینی حقوقی',
  };
}

/* ---------------------------------------------------------------- *
 * آمار و تحلیل
 * ---------------------------------------------------------------- */
function analyze(articles) {
  const nums = articles.map((a) => a.numberValue).filter((n) => typeof n === 'number');
  const set = new Set(nums);
  const max = nums.length ? Math.max(...nums) : 0;
  const missing = [];
  for (let i = 1; i <= max; i++) if (!set.has(i)) missing.push(i);
  const mokarrar = articles.filter((a) => a.mokarrar).length;
  return { max, missing, mokarrar, count: articles.length };
}

function chapterSummary(articles) {
  const out = [];
  for (const a of articles) {
    const title = (a.path || []).join(' › ') || 'بدون فصل‌بندی';
    const last = out[out.length - 1];
    if (last && last.title === title) {
      last.to = a.numberFa;
      last.count++;
    } else {
      out.push({ title, from: a.numberFa, to: a.numberFa, count: 1 });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- *
 * اجرا
 * ---------------------------------------------------------------- */
function main() {
  const catalog = readJson(path.join(CURATED, 'catalog.json'));
  const appInfo = readJson(path.join(CURATED, 'app-info.json'));
  const referenceLaws = readJson(path.join(CURATED, 'reference-laws.json'));
  const entities = readJson(path.join(CURATED, 'entities.json'));
  const titleIndex = readJsonMaybe(path.join(CURATED, 'law-title-index.json'), { laws: [] });
  const extraEntities = readJsonMaybe(path.join(CURATED, 'entities-extra.json'), { groups: [] });

  /* فهرست مرجع (قوانین بدون متن) به انتهای فهرست قوانین افزوده می‌شود تا هیچ
     مدخل موجودی تغییر نکند. منبع پیش‌فرض این اسناد از فایل reference-laws.json خوانده می‌شود. */
  const registrySource = referenceLaws.source || { kind: 'reference' };
  const titleIndexSource = titleIndex.source || { kind: 'reference', name: 'فهرست عناوین' };
  const allLawDefs = [
    ...catalog.laws,
    ...(referenceLaws.laws || []).map((l) => ({
      ...l,
      source: { ...registrySource, ...(l.source || {}) },
    })),
    ...(titleIndex.laws || []).map((l) => ({
      ...l,
      origin: l.origin || 'law-title-index',
      source: { ...titleIndexSource, kind: 'reference', ...(l.source || {}) },
    })),
  ];

  const lawsMeta = [];
  const lawFiles = {};
  const report = [];

  for (const lawDef of allLawDefs) {
    let built;
    switch (lawDef.source.kind) {
      case 'corpus': built = buildFromCorpus(lawDef); break;
      case 'hub': built = buildFromHub(lawDef); break;
      case 'constitution': built = buildConstitution(lawDef); break;
      case 'curated': built = buildFromCurated(lawDef); break;
      case 'reference': built = buildReference(lawDef, registrySource); break;
      default: throw new Error(`نوع منبع نامعتبر: ${lawDef.source.kind}`);
    }

    const title = lawDef.title || built.meta.title;
    const approval = lawDef.approvalDate || built.meta.approval || '';
    const lawRecord = {
      id: lawDef.id,
      title,
      shortTitle: lawDef.shortTitle || title,
      category: lawDef.category,
      hierarchy: lawDef.hierarchy,
      documentType: lawDef.documentType || 'قانون',
      approvalDate: approval ? toFaDigits(approval) : '',
      approvalSort: lawDef.approvalSort || dateToSort(approval),
      status: lawDef.status || 'لازم‌الاجرا',
      summary: lawDef.summary || '',
      keywords: lawDef.keywords || [],
      checklist: lawDef.checklist || [],
      source: { ...lawDef.source, name: lawDef.source.name || built.sourceName },
      origin: lawDef.origin || 'curated',
      note: built.meta.note || '',
      articleRange: built.meta.articleRange || '',
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    let articles = built.articles.map((a) => normalizeArticle(lawRecord, a, title));

    // تکمیل مواد ناموجود از منبع پشتیبان (در صورت تعریف در کاتالوگ)
    const filled = [];
    if (lawDef.fillFrom) {
      const stats0 = analyze(articles);
      if (stats0.missing.length) {
        const alt = lawDef.fillFrom.kind === 'corpus' ? buildFromCorpus({ source: lawDef.fillFrom })
          : buildFromHub({ source: lawDef.fillFrom });
        const present = new Set(articles.map((a) => a.numberValue));
        for (const m of stats0.missing) {
          const candidate = alt.articles.find((a) => Number(a.number) === m && !a.mokarrar);
          if (!candidate) continue;
          const art = normalizeArticle(lawRecord, candidate, title);
          art.filledFrom = lawDef.fillFrom.label;
          articles.push(art);
          filled.push(m);
          present.add(m);
        }
        articles.sort((a, b) => (a.numberValue ?? 0) - (b.numberValue ?? 0) || String(a.number).localeCompare(String(b.number)));
      }
    }

    const stats = analyze(articles);

    // مواد «منتقل‌شده» به سند دیگر (مثل مواد ۲۱ تا ۹۳ قانون تجارت) به‌عنوان خلأ محاسبه نمی‌شود
    let missing = stats.missing;
    let movedTo = null;
    if (lawDef.gapPolicy?.movedTo) {
      const ranges = Object.values(lawDef.gapPolicy.movedTo).flat();
      missing = missing.filter((n) => !ranges.some(([a, b]) => n >= a && n <= b));
      movedTo = lawDef.gapPolicy;
    }

    lawRecord.articleCount = articles.length;
    lawRecord.chapters = chapterSummary(articles);
    lawRecord.gaps = { count: missing.length, items: missing.slice(0, 40) };
    lawRecord.movedTo = movedTo;
    if (filled.length) lawRecord.filledFrom = { label: lawDef.fillFrom.label, numbers: filled };
    lawRecord.range = { from: 1, to: stats.max };

    const payload = JSON.stringify({ law: lawRecord, articles });
    const hash = sha256(payload).slice(0, 12);

    lawFiles[lawRecord.id] = { payload, hash, count: articles.length };
    lawsMeta.push({ ...lawRecord, hash });

    report.push({
      id: lawRecord.id,
      title,
      count: articles.length,
      missing: missing.length,
      moved: movedTo ? 1 : 0,
      max: stats.max,
      reference: articles.length === 0,
      titleIndex: lawRecord.origin === 'law-title-index',
    });
  }

  /* نسخه‌ی داده: نسخه‌ی معنایی + هش محتوا برای تشخیص تغییر */
  const aggregateHash = sha256(Object.entries(lawFiles).map(([k, v]) => `${k}:${v.hash}`).sort().join('|')).slice(0, 8);
  const version = `${appInfo.dataVersion}+${aggregateHash}`;
  const versionDir = path.join(PUBLIC, 'data', 'v', version);
  // پوشه نسخه از صفر ساخته می‌شود تا فایل‌های قدیمی (مثلاً قالب پیش از قطعه‌بندی) باقی نمانند
  fs.rmSync(versionDir, { recursive: true, force: true });
  ensureDir(path.join(versionDir, 'laws'));

  const totalArticles = lawsMeta.reduce((s, l) => s + l.articleCount, 0);

  /* نهادها، سازمان‌ها، بانک‌ها و … (فهرست مرجع + استخراج‌شده از منابع) */
  const entityGroups = [...(entities.groups || []), ...(extraEntities.groups || [])]
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      ...g,
      items: (g.items || []).map((item) => ({
        id: item.id,
        title: item.title,
        shortTitle: item.shortTitle || item.title,
        abbr: item.abbr || '',
        note: item.note || '',
        group: g.id,
        status: item.status || 'فعال',
        source:
          item.source ||
          (g.id === 'councils-and-authorities'
            ? extraEntities.source?.name || 'استخراج‌شده از منابع'
            : entities.source?.name || 'فهرست مرجع ورودی'),
      })),
    }));
  const entityCount = entityGroups.reduce((s, g) => s + g.items.length, 0);

  const clientCatalog = {
    version,
    appVersion: appInfo.appVersion,
    releasedAt: new Date().toISOString().slice(0, 10),
    releasedAtFa: toFaDigits(appInfo.releasedAt || ''),
    appName: appInfo.appName,
    shortName: appInfo.shortName,
    credits: appInfo.credits,
    disclaimer: appInfo.disclaimer,
    privacy: appInfo.privacy,
    officialSources: appInfo.officialSources,
    hierarchyNote: appInfo.hierarchyNote,
    dataSources: appInfo.dataSources,
    categories: catalog.categories,
    hierarchy: catalog.hierarchy,
    checklist: catalog.checklist,
    guides: catalog.guides || [],
    laws: lawsMeta,
    entityGroups,
    stats: {
      lawCount: lawsMeta.length,
      articleCount: totalArticles,
      categoryCount: catalog.categories.length,
      entityCount,
      /** اسنادی که متن ماده‌به‌ماده دارند */
      fullTextCount: lawsMeta.filter((l) => l.articleCount > 0).length,
      /** اسناد فقط‌شناسنامه برگرفته از فهرست مرجع ورودی */
      referenceLawCount: lawsMeta.filter((l) => l.articleCount === 0 && l.origin !== 'law-title-index').length,
      /** عناوین استخراج‌شده از فهرست منبع (فقط نام سند) */
      titleIndexCount: lawsMeta.filter((l) => l.origin === 'law-title-index').length,
    },
  };

  writeJson(path.join(versionDir, 'catalog.json'), clientCatalog);

  /* هر قانون به بخش‌های حداکثر ~۳۰۰ ماده / ۳۵۰ کیلوبایت شکسته می‌شود
     تا بارگذاری اولیه و به‌روزرسانی دلتا روی موبایل سبک بماند. */
  const CHUNK_ARTICLES = 300;
  const pointerLaws = [];
  for (const meta of lawsMeta) {
    const file = lawFiles[meta.id];
    // اسناد ارجاعی (بدون متن ماده) فایل داده‌ای ندارند؛ فقط در کاتالوگ هستند.
    if (!file.count) continue;
    const parsed = JSON.parse(file.payload);
    const parts = [];
    const chunks = [];
    for (let i = 0; i < parsed.articles.length; i += CHUNK_ARTICLES) {
      chunks.push(parsed.articles.slice(i, i + CHUNK_ARTICLES));
    }
    if (!chunks.length) chunks.push([]);
    chunks.forEach((articles, index) => {
      const partName = `${meta.id}.p${index}.json`;
      const body = JSON.stringify({ law: index === 0 ? parsed.law : undefined, articles });
      fs.writeFileSync(path.join(versionDir, 'laws', partName), body, 'utf8');
      parts.push({
        path: `/data/v/${version}/laws/${partName}`,
        bytes: Buffer.byteLength(body),
        count: articles.length,
      });
    });
    pointerLaws.push({
      id: meta.id,
      hash: file.hash,
      bytes: parts.reduce((s, p) => s + p.bytes, 0),
      count: file.count,
      title: meta.shortTitle,
      category: meta.category,
      hierarchy: meta.hierarchy,
      parts,
    });
  }

  const pointer = {
    version,
    releasedAt: new Date().toISOString().slice(0, 10),
    catalogPath: `/data/v/${version}/catalog.json`,
    laws: pointerLaws,
    stats: { lawCount: lawsMeta.length, articleCount: totalArticles },
  };

  /* مجموعهٔ اختیاری آراء قضایی (منبع حجیم؛ فقط در صورت وجود فایل ساخته می‌شود) */
  const cases = buildCases({ versionDir, version });
  if (cases) pointer.cases = cases.pointer;

  writeJson(path.join(PUBLIC, 'data', 'version.json'), pointer);

  /* پاک‌سازی نسخه‌های قدیمی (فقط ۲ نسخه آخر نگه داشته می‌شود).
     مجموعهٔ آراءِ نسخهٔ پیشین همیشه حذف می‌شود — حجیم است و دریافتِ آن اختیاری است. */
  const versionsDir = path.join(PUBLIC, 'data', 'v');
  const all = fs.readdirSync(versionsDir).filter((d) => d !== version).sort();
  for (const old of all) {
    fs.rmSync(path.join(versionsDir, old, 'cases'), { recursive: true, force: true });
  }
  for (const old of all.slice(0, Math.max(0, all.length - 1))) {
    fs.rmSync(path.join(versionsDir, old), { recursive: true, force: true });
  }

  /* گزارش */
  console.log(`\n📚 کتابچه قانون — ساخت داده‌ها\n   نسخه: ${version}`);
  console.log(
    `   ${lawsMeta.length} سند حقوقی | ${toFaDigits(clientCatalog.stats.fullTextCount)} با متن کامل | ${toFaDigits(clientCatalog.stats.referenceLawCount)} فقط‌شناسنامه | ${toFaDigits(clientCatalog.stats.titleIndexCount)} عنوانِ فهرستی`,
  );
  console.log(`   ${toFaDigits(totalArticles)} ماده`);
  console.log(`   ${toFaDigits(entityCount)} نهاد/سازمان در ${toFaDigits(entityGroups.length)} گروه\n`);
  const pad = (s, n) => String(s).padEnd(n);
  for (const r of report) {
    const gap = r.reference ? (r.titleIndex ? ' ＋ عنوان فهرستی' : ' ↷ فقط شناسنامه (متن در منابع آزاد نیست)')
      : r.missing ? ` ⚠ ${r.missing} ماده ناموجود در منبع`
      : r.moved ? ' ↪ مواد ۲۱–۹۳ در لایحه اصلاحی ۱۳۴۷'
      : '';
    console.log(`   ${pad(r.id, 46)} ${pad(r.count, 6)} ماده${gap}`);
  }
  const withGaps = report.filter((r) => r.missing > 0);
  if (withGaps.length) {
    console.log(`\n   ⚠ ${withGaps.length} قانون دارای ماده ناموجود در منبع است (در «گزارش پوشش» برنامه نمایش داده می‌شود).`);
  }
  console.log(`\n   خروجی: public/data/version.json و public/data/v/${version}/\n`);
}

main();
