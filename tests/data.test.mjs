/**
 * تست‌های یکپارچگی داده‌های تولیدشده (خروجی scripts/build-data.mjs).
 *
 * این تست‌ها روی فایل‌های `public/data` اجرا می‌شوند — یعنی همان چیزی که
 * برنامه در زمان اجرا مصرف می‌کند. هرگونه ناسازگاریِ آمار، شناسه، قطعه‌ها
 * یا مجموعهٔ آراء در اینجا باید شکار شود.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const inPublic = (urlPath) => path.join(PUBLIC, urlPath.replace(/^\//, ''));

const pointerPath = path.join(PUBLIC, 'data', 'version.json');

test('فایل version.json وجود دارد و ساختار پایه درست است', () => {
  assert.ok(fs.existsSync(pointerPath), 'public/data/version.json ساخته نشده است');
  const pointer = read(pointerPath);
  assert.ok(pointer.version, 'نسخه ثبت نشده است');
  assert.ok(pointer.releasedAt, 'تاریخ انتشار ثبت نشده است');
  assert.ok(pointer.catalogPath, 'مسیر فهرست ثبت نشده است');
  assert.ok(Array.isArray(pointer.laws) && pointer.laws.length, 'فهرست قطعه‌های قوانین خالی است');
  assert.ok(fs.existsSync(inPublic(pointer.catalogPath)), 'فایل فهرست یافت نشد');
});

const pointer = fs.existsSync(pointerPath) ? read(pointerPath) : null;
const versionDir = pointer ? path.join(PUBLIC, 'data', 'v', pointer.version) : null;
const catalog = versionDir ? read(path.join(versionDir, 'catalog.json')) : null;

test('فهرست (catalog) بخش‌های اصلی را دارد', () => {
  assert.ok(catalog, 'فهرست بارگذاری نشد');
  for (const key of ['categories', 'hierarchy', 'laws', 'entityGroups', 'stats']) {
    assert.ok(catalog[key], `بخش «${key}» در فهرست نیست`);
  }
  assert.equal(catalog.version ?? pointer.version, pointer.version);
});

test('شناسهٔ قوانین یکتاست', () => {
  const ids = catalog.laws.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'شناسهٔ تکراری در قوانین وجود دارد');
});

test('آمار فهرست با محتوای واقعی هم‌خوان است', () => {
  const s = catalog.stats;
  const withText = catalog.laws.filter((l) => (l.articleCount ?? 0) > 0);
  const onlyTitle = catalog.laws.filter((l) => (l.articleCount ?? 0) === 0 && l.origin === 'law-title-index');
  const onlyRef = catalog.laws.filter(
    (l) => (l.articleCount ?? 0) === 0 && l.origin !== 'law-title-index',
  );
  assert.equal(s.lawCount, catalog.laws.length, 'شمار کل اسناد ناسازگار است');
  assert.equal(s.fullTextCount, withText.length, 'شمار اسناد با متن ناسازگار است');
  assert.equal(s.titleIndexCount, onlyTitle.length, 'شمار عنوان‌های فهرستی ناسازگار است');
  assert.equal(s.referenceLawCount, onlyRef.length, 'شمار اسناد فقط‌شناسنامه ناسازگار است');
  assert.equal(s.categoryCount, catalog.categories.length, 'شمار دسته‌ها ناسازگار است');

  const sumArticles = catalog.laws.reduce((n, l) => n + (l.articleCount ?? 0), 0);
  assert.equal(s.articleCount, sumArticles, 'شمار کل ماده‌ها ناسازگار است');

  const entities = catalog.entityGroups.reduce((n, g) => n + (g.items?.length ?? 0), 0);
  assert.equal(s.entityCount, entities, 'شمار نهادها ناسازگار است');
});

test('دسته و سلسله‌مراتب هر سند معتبر است', () => {
  const cats = new Set(catalog.categories.map((c) => c.id));
  const hiers = new Set(catalog.hierarchy.map((h) => h.id));
  for (const law of catalog.laws) {
    assert.ok(cats.has(law.category), `${law.id}: دستهٔ نامعتبر «${law.category}»`);
    assert.ok(hiers.has(law.hierarchy), `${law.id}: سلسله‌مراتب نامعتبر «${law.hierarchy}»`);
    assert.ok(law.title?.trim(), `${law.id}: عنوان خالی است`);
  }
});

test('قطعه‌های ماده‌ها با آمار و شناسه‌ها هم‌خوان است', () => {
  const byId = new Map(pointer.laws.map((l) => [l.id, l]));
  const seenArticleIds = new Set();
  let total = 0;
  for (const law of catalog.laws) {
    const meta = byId.get(law.id);
    if ((law.articleCount ?? 0) === 0) {
      assert.equal(meta, undefined, `${law.id}: سند بدون ماده نباید قطعه داشته باشد`);
      continue;
    }
    assert.ok(meta, `${law.id}: قطعه‌ای در version.json ثبت نشده است`);
    let count = 0;
    for (const part of meta.parts) {
      const file = inPublic(part.path);
      assert.ok(fs.existsSync(file), `${law.id}: فایل قطعه یافت نشد (${part.path})`);
      const body = read(file);
      const articles = Array.isArray(body) ? body : body.articles ?? [];
      for (const a of articles) {
        assert.equal(a.lawId, law.id, `مادهٔ ${a.id} متعلق به ${a.lawId} است نه ${law.id}`);
        assert.ok(!seenArticleIds.has(a.id), `شناسهٔ مادهٔ تکراری: ${a.id}`);
        seenArticleIds.add(a.id);
        count++;
      }
    }
    assert.equal(count, meta.count, `${law.id}: شمار ماده‌های قطعه با برآورد هم‌خوان نیست`);
    assert.equal(count, law.articleCount, `${law.id}: شمار ماده‌های قطعه با فهرست هم‌خوان نیست`);
    total += count;
  }
  assert.equal(total, catalog.stats.articleCount, 'جمع ماده‌های قطعه‌ها با آمار هم‌خوان نیست');
});

test('مدخل‌های «فقط عنوان» معتبرند و با اسناد دیگر تداخل ندارند', () => {
  const squash = (t) => t.replace(/\s+/g, '');
  const titles = new Map();
  const index = catalog.laws.filter((l) => l.origin === 'law-title-index');
  assert.ok(index.length > 0, 'هیچ عنوان فهرستی در خروجی نیست');
  for (const law of index) {
    assert.ok(law.summary?.trim(), `${law.id}: خلاصه ندارد`);
    assert.ok(law.title.includes(' '), `${law.id}: عنوان تک‌واژه‌ای است (${law.title})`);
    assert.equal(law.articleCount, 0, `${law.id}: عنوان فهرستی نباید ماده داشته باشد`);
    const key = squash(law.title);
    assert.ok(!titles.has(key), `${law.id}: عنوان تکراری «${law.title}»`);
    titles.set(key, law.id);
    assert.ok(Array.isArray(law.keywords) && law.keywords.length, `${law.id}: کلیدواژه ندارد`);
  }
  for (const law of catalog.laws) {
    if (law.origin === 'law-title-index') continue;
    assert.ok(!titles.has(squash(law.title)), `عنوان «${law.title}» هم در فهرست عناوین و هم در اسناد اصلی است`);
  }
});

test('نهادها شناسهٔ یکتا و گروه معتبر دارند', () => {
  const groupIds = new Set(catalog.entityGroups.map((g) => g.id));
  assert.equal(groupIds.size, catalog.entityGroups.length, 'شناسهٔ گروه نهاد تکراری است');
  const seen = new Set();
  for (const group of catalog.entityGroups) {
    assert.ok(group.title?.trim(), `گروه ${group.id}: عنوان ندارد`);
    assert.ok((group.items ?? []).length, `گروه ${group.id}: بدون عضو است`);
    for (const item of group.items) {
      assert.ok(!seen.has(item.id), `شناسهٔ نهاد تکراری: ${item.id}`);
      seen.add(item.id);
      assert.equal(item.group, group.id, `نهاد ${item.id}: گروه ناسازگار است`);
      assert.ok(item.title?.trim(), `نهاد ${item.id}: عنوان ندارد`);
    }
  }
});

test('مجموعهٔ آراء قضایی (در صورت وجود) با اشاره‌گر هم‌خوان است', () => {
  const cp = pointer.cases;
  if (!cp) {
    return; // نسخه شامل آراء نیست
  }
  assert.ok(cp.count > 0, 'شمار آراء ثبت نشده است');
  assert.ok(Array.isArray(cp.parts) && cp.parts.length, 'قطعه‌ای برای آراء ثبت نشده است');

  const indexPath = inPublic(cp.indexPath);
  assert.ok(fs.existsSync(indexPath), 'فایل فهرست آراء یافت نشد');
  const index = read(indexPath).index;
  assert.equal(index.length, cp.count, 'شمار مدخل‌های فهرست آراء با اشاره‌گر هم‌خوان نیست');

  const ids = new Set();
  for (const row of index) {
    assert.ok(!ids.has(row.id), `شناسهٔ رأی تکراری: ${row.id}`);
    ids.add(row.id);
    assert.ok(row.title?.trim(), `رأی ${row.id}: عنوان ندارد`);
    assert.ok(row.norm?.trim(), `رأی ${row.id}: متن جست‌وجو ندارد`);
    assert.ok(cp.types.includes(row.type), `رأی ${row.id}: نوع نامعتبر «${row.type}»`);
    assert.equal(typeof row.dateSort, 'number', `رأی ${row.id}: تاریخ مرتب‌سازی نامعتبر است`);
  }

  let count = 0;
  let bytes = cp.indexBytes;
  for (const part of cp.parts) {
    const file = inPublic(part.path);
    assert.ok(fs.existsSync(file), `قطعهٔ آراء یافت نشد: ${part.path}`);
    const body = read(file);
    assert.equal(body.items.length, part.count, `قطعهٔ ${part.path}: شمار رأی‌ها هم‌خوان نیست`);
    for (const item of body.items) {
      assert.ok(ids.has(item.id), `رأی ${item.id} در فهرست نیست`);
      assert.ok(item.text?.length >= 40, `رأی ${item.id}: متن بسیار کوتاه است`);
      assert.ok(item.norm?.trim(), `رأی ${item.id}: متن جست‌وجو ندارد`);
      assert.ok(['اداری', 'حقوقی', 'کیفری'].includes(item.type), `رأی ${item.id}: نوع نامعتبر`);
    }
    count += body.items.length;
    bytes += part.bytes;
  }
  assert.equal(count, cp.count, 'جمع رأی‌های قطعه‌ها با اشاره‌گر هم‌خوان نیست');
  assert.equal(bytes, cp.bytes, 'حجم اعلام‌شدهٔ مجموعه با قطعه‌ها هم‌خوان نیست');
});
