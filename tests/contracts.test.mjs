import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../data/contracts/${name}`, import.meta.url), 'utf8'));
const { topics, contracts } = read('contracts.json');
const { guides, steps, comparisons } = read('education.json');

test('هر نوع قرارداد، راهنمای مثال عملی و چک‌لیست اختصاصی دارد', () => {
  const ids = contracts.map((c) => c.id);
  assert.equal(ids.length, new Set(ids).size, 'شناسه تکراری');
  assert.deepEqual(Object.keys(guides).sort(), ids.sort(), 'مثال یتیم یا بدون راهنما');
  const topicIds = new Set(topics.map((t) => t.id));
  for (const c of contracts) {
    assert.ok(topicIds.has(c.topic), `${c.id}: موضوع ناشناخته`);
    assert.ok(c.title && c.parties.length > 0 && c.clauses.length >= 4, `${c.id}: داده ناقص`);
    assert.ok(c.clauses.every((x) => x.title && x.text.length >= 45), `${c.id}: بند ناقص یا بیش‌ازحد کلی`);
    const guide = guides[c.id];
    assert.ok(guide.scenario.length > 12 && guide.sample.length > 45 && guide.lesson.length > 35, `${c.id}: مثال سطحی`);
    assert.ok(guide.checklist.length >= 3 && guide.checklist.every((x) => x.length > 8), `${c.id}: چک‌لیست ناقص`);
  }
});

test('راهنمای عمومی، مثال‌های بازنویسی متنوع و دارای توضیح دارد', () => {
  assert.ok(steps.length >= 5);
  assert.ok(comparisons.length >= 5);
  for (const comparison of comparisons) {
    assert.ok(comparison.weak && comparison.better.length > comparison.weak.length && comparison.why);
  }
});

test('عبارت‌های حقوقیِ گمراه‌کننده در سرفصل‌های حساس بازنگری شده‌اند', () => {
  const byId = Object.fromEntries(contracts.map((c) => [c.id, c]));
  assert.doesNotMatch(byId['civil-guarantee'].clauses[3].text, /در صورت عدم پرداخت توسط اصلی/);
  assert.match(byId['fam-divorce-agreement'].notes, /توافق خصوصی به‌تنهایی/);
  assert.match(byId['re-presale'].notes, /تنظیم رسمی/);
  assert.match(byId['labor-fixed-term'].notes, /قانون کار/);
  assert.ok(contracts.every((c) => c.notes && c.clauses.every((x) => x.title.startsWith('بند '))));
});
