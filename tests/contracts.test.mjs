import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../data/contracts/${name}`, import.meta.url), 'utf8'));
const { topics, contracts } = read('contracts.json');
const { guides, steps, comparisons } = read('education.json');
const { examples } = read('case-studies.json');
const { laws } = JSON.parse(fs.readFileSync(new URL('../data/curated/catalog.json', import.meta.url), 'utf8'));

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

test('مطالعه‌های موردی همه موضوع‌ها را پوشش می‌دهند و به قوانین موجود متصل‌اند', () => {
  assert.ok(examples.length >= contracts.length, 'مطالعه‌های موردی کافی نیستند');
  assert.equal(new Set(examples.map((x) => x.id)).size, examples.length, 'شناسه نمونه تکراری است');
  assert.deepEqual([...new Set(examples.map((x) => x.contractId))].sort(), contracts.map((c) => c.id).sort(),
    'هر نوع قرارداد باید دست‌کم یک مطالعه موردی داشته باشد');
  const contractsById = new Map(contracts.map((c) => [c.id, c]));
  const lawIds = new Set(laws.map((law) => law.id));
  const representedTopics = new Set();
  for (const example of examples) {
    const contract = contractsById.get(example.contractId);
    assert.ok(contract, `${example.id}: نوع قرارداد نامعتبر`);
    representedTopics.add(contract.topic);
    assert.ok(example.title && example.situation.length > 30 && example.facts.length >= 2, `${example.id}: موقعیت ناکامل`);
    assert.ok(example.clauses.length >= 2 && example.clauses.every((cl) =>
      cl.heading && cl.wording.length > 70 && cl.rationale.length > 35 && !/\.{4,}/.test(cl.wording),
    ), `${example.id}: بند نمونه ناقص یا دارای جای‌خالی`);
    assert.ok(example.review.length >= 2 && example.references.length, `${example.id}: بررسی یا قانون مرتبط موجود نیست`);
    for (const ref of example.references) assert.ok(lawIds.has(ref.lawId), `${example.id}: قانون ${ref.lawId} در فهرست نیست`);
    if (example.payments) {
      assert.ok(example.payments.totalRials > 0 && example.payments.items.length >= 2, `${example.id}: جدول پرداخت ناقص`);
      assert.ok(example.payments.items.every((item) => item.label && item.amountRials > 0), `${example.id}: قسط نامعتبر`);
      assert.equal(example.payments.items.reduce((sum, item) => sum + item.amountRials, 0),
        example.payments.totalRials, `${example.id}: جمع مبالغ نادرست`);
    }
  }
  assert.deepEqual([...representedTopics].sort(), topics.map((t) => t.id).sort(), 'همه موضوع‌ها مثال تکمیل‌شده ندارند');
});

test('نمونه SLA محاسبه درست و موضوعات حساس هشدار صریح دارند', () => {
  assert.equal(Math.round(30 * 24 * 60 * (1 - 0.995)), 216);
  const sla = examples.find((example) => example.id === 'saas-availability');
  assert.match(sla.facts.join(' '), /۴۳٬۲۰۰/);
  assert.match(sla.facts.join(' '), /۲۱۶/);
  for (const id of ['apartment-purchase', 'child-visits', 'divorce-settlement']) {
    assert.ok(examples.find((example) => example.id === id)?.disclaimer, `${id}: هشدار لازم دارد`);
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
