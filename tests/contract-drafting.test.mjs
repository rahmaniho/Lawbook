import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BASIC_FIELDS, contextualFieldLabel, draftFields, emptyDraft, hasUnresolvedPrompt, prepareDraft, suggestionReferences, suggestionsForClause } from '../src/lib/contract-drafting';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../data/contracts/${name}`, import.meta.url), 'utf8'));
const { contracts, topics } = read('contracts.json');
const config = read('draft-config.json');
const suggestionCatalog = read('clause-suggestions.json');

const sorted = (items) => [...items].sort();

test('فرم برای همه ۳۰ نوع و ۷ دسته تعریف شده و فیلدهای آن یکتا است', () => {
  assert.equal(contracts.length, 30);
  assert.deepEqual(sorted(Object.keys(config.contractFields)), sorted(contracts.map(({ id }) => id)));
  assert.deepEqual(sorted(Object.keys(config.topicFields)), sorted(topics.map(({ id }) => id)));
  assert.deepEqual(sorted(Object.keys(config.topicReviews)), sorted(topics.map(({ id }) => id)));
  for (const topic of topics) {
    assert.equal(config.topicReviews[topic.id].length, 3, `${topic.id}: چک‌لیست تخصصی ناقص است`);
    assert.ok(config.topicReviews[topic.id].every((point) => point.length > 100));
  }
  assert.equal(new Set(BASIC_FIELDS.map((field) => field.id)).size, BASIC_FIELDS.length);
  for (const contract of contracts) {
    const fields = draftFields(config, contract);
    assert.ok(fields.length >= 3, `${contract.id}: جزئیات اختصاصی ناکافی است`);
    assert.equal(new Set(fields.map((field) => field.id)).size, fields.length, `${contract.id}: شناسه فیلد تکراری است`);
    assert.ok(fields.every((field) => field.id && field.label && field.hint?.length >= 70), `${contract.id}: فیلد اختصاصی یا راهنمای تخصصی ناقص است`);
  }
  const official = Object.keys(config.formalWorkbooks);
  assert.equal(official.length, 9);
  assert.ok(official.includes('fam-marriage') && official.includes('re-presale'));
  assert.ok(official.every((id) => contracts.some((contract) => contract.id === id) && config.formalWorkbooks[id].length > 45));
});

test('پیش‌نمایش خالی چاپ‌پذیر نیست و هیچ راهنمای آموزشی را به‌عنوان بند نمی‌افزاید', () => {
  for (const contract of contracts) {
    const preview = prepareDraft(config, contract, emptyDraft());
    assert.equal(preview.printable, false);
    assert.equal(preview.clauses.length, 0);
    assert.equal(preview.missingClauses.length, contract.clauses.length);
    assert.ok(preview.issues.length >= 4);
    assert.equal(preview.formalNotice, config.formalWorkbooks[contract.id] ?? '');
  }
});

test('چاپ فقط داده‌ها و بندهای نوشته‌شده توسط کاربر را نمایش می‌دهد؛ سرفصل ناتمام را اعلام می‌کند', () => {
  const contract = contracts.find((item) => item.id === 'civil-sale-movable');
  const input = emptyDraft();
  input.basics = { partyOne: '  الف  ', partyTwo: 'ب', subject: 'میز کار', partyOneId: '  ' };
  input.details = { description: ' میز چوبی ', payment: '  ', serial: ' سریال ۱۲۳ ' };
  input.clauses = { 0: ' بند نگارش‌شده توسط کاربر ', 1: '   ' };
  input.additions = [{ id: 'extra-1', title: 'تعهد ویژه', text: 'مفاد نگارش‌شده' }];
  const preview = prepareDraft(config, contract, input);
  assert.equal(preview.printable, true);
  assert.deepEqual(preview.basics.map(({ text }) => text), ['الف', 'ب', 'میز کار']);
  assert.deepEqual(preview.facts.map(({ text }) => text), ['میز چوبی', 'سریال ۱۲۳']);
  assert.equal(preview.clauses.length, 1);
  assert.equal(preview.clauses[0].text, 'بند نگارش‌شده توسط کاربر');
  assert.equal(preview.additions[0].text, 'مفاد نگارش‌شده');
  assert.ok(preview.missingClauses.includes(contract.clauses[1].title));
  assert.ok(!JSON.stringify(preview).includes(contract.clauses[1].text));
});

test('بند افزوده ناقص اجازه چاپ از دکمه را نمی‌دهد و خروجی حساس هشدار رسمی دارد', () => {
  const contract = contracts.find((item) => item.id === 'fam-marriage');
  const input = emptyDraft();
  input.basics = { partyOne: 'شخص اول', partyTwo: 'شخص دوم', subject: 'بررسی شروط ازدواج' };
  input.clauses = { 0: 'پیشنهاد اولیه برای بررسی' };
  input.additions = [{ id: 'extra-1', title: 'عنوان بی‌متن', text: '' }];
  const preview = prepareDraft(config, contract, input);
  assert.equal(preview.printable, false);
  assert.equal(preview.additions.length, 0);
  assert.ok(preview.issues.some((item) => item.includes('بندهای افزوده‌شده')));
  assert.match(preview.formalNotice, /سند نکاح نیست/);
});

test('هر ۱۷۷ سرفصل، متن مستقل و قابل تکمیل دارد؛ ارجاع تنها برای بندهای دارای منبع مشخص است', () => {
  assert.deepEqual(sorted(Object.keys(suggestionCatalog.suggestions)), sorted(contracts.map(({ id }) => id)));
  assert.deepEqual(sorted(Object.keys(suggestionCatalog.introductions)), sorted(contracts.map(({ id }) => id)));
  const version = JSON.parse(fs.readFileSync(new URL('../public/data/version.json', import.meta.url), 'utf8'));
  const laws = new Map(version.laws.map((law) => [law.id, law]));
  const referencedArticles = new Set();
  for (const [lawId, title] of Object.entries(suggestionCatalog.sources)) {
    assert.ok(laws.has(lawId) && title.length > 5, `منبع ${lawId} ناشناخته است`);
    for (const part of laws.get(lawId).parts) {
      const content = JSON.parse(fs.readFileSync(new URL(`../public${part.path}`, import.meta.url), 'utf8'));
      for (const article of content.articles) if (article.text?.trim()) referencedArticles.add(article.id);
    }
  }
  const allTexts = new Set();
  let total = 0;
  for (const contract of contracts) {
    const suggestions = suggestionCatalog.suggestions[contract.id];
    assert.ok(suggestionCatalog.introductions[contract.id].length > 120, `${contract.id}: معرفی تخصصی ناقص است`);
    assert.equal(suggestions.length, contract.clauses.length, `${contract.id}: پوشش همه بندها لازم است`);
    assert.deepEqual(suggestions.map((item) => item.clauseIndex), contract.clauses.map((_, index) => index));
    assert.equal(suggestions.filter((item) => item.articleIds.length > 0).length, 2, `${contract.id}: ارجاع‌های موجود باید حفظ شوند، نه برای پرکردن پوشش جعل شوند`);
    for (const suggestion of suggestions) {
      total++;
      assert.ok(suggestion.text.length > 200 && suggestion.reason.length > 40, `${contract.id}: متن یا محور کنترل سطحی است`);
      assert.ok(hasUnresolvedPrompt(suggestion.text), `${contract.id}: داده واقعی باید تکمیل شود`);
      assert.equal((suggestion.text.match(/⟦/g) ?? []).length, (suggestion.text.match(/⟧/g) ?? []).length, `${contract.id}: نشانگر ناقص`);
      assert.ok(!allTexts.has(suggestion.text), `${contract.id}: متن تکراری است`);
      allTexts.add(suggestion.text);
      assert.ok(suggestion.articleIds.every((id) => referencedArticles.has(id)), `${contract.id}: شناسه ماده وجود ندارد`);
      assert.ok(suggestionReferences(suggestionCatalog, suggestion).every((ref) => ref.lawTitle && ref.number));
      assert.deepEqual(suggestionsForClause(suggestionCatalog, contract.id, suggestion.clauseIndex), [suggestion]);
      if (config.formalWorkbooks[contract.id]) {
        assert.ok(suggestion.text.startsWith('برای بررسی'), `${contract.id}: متن کاربرگ نباید شرط اجرایی قرارداد جلوه کند`);
      }
    }
  }
  assert.equal(total, 177);
});

test('پیشنهاد تنها پس از درج آگاهانه وارد متن می‌شود و تا تکمیل جای‌خالی چاپ فعال نیست', () => {
  const contract = contracts.find(({ id }) => id === 'civil-sale-movable');
  const input = emptyDraft();
  input.basics = { partyOne: 'الف', partyTwo: 'ب', subject: 'فروش میز' };
  const suggestion = suggestionCatalog.suggestions[contract.id][0];
  assert.equal(prepareDraft(config, contract, input).clauses.length, 0, 'نمایش پیشنهاد نباید متن چاپی بسازد');
  input.clauses[String(suggestion.clauseIndex)] = suggestion.text;
  assert.ok(hasUnresolvedPrompt(suggestion.text));
  assert.ok(hasUnresolvedPrompt('عبارت ⟦نیمه‌کاره'));
  assert.ok(hasUnresolvedPrompt('عبارت نیمه‌کاره⟧'));
  const incomplete = prepareDraft(config, contract, input);
  assert.equal(incomplete.printable, false);
  assert.ok(incomplete.issues.some((issue) => issue.includes('جای‌خالی')));
  input.clauses[String(suggestion.clauseIndex)] = suggestion.text.replace(/⟦[^⟧]+⟧/g, 'اطلاعات واقعی');
  const revised = prepareDraft(config, contract, input);
  assert.equal(revised.printable, true);
  assert.equal(revised.clauses[0].text, input.clauses[String(suggestion.clauseIndex)]);
  assert.ok(!JSON.stringify(revised).includes(suggestion.articleIds[0]), 'ارجاع مطالعه نباید خودکار تبدیل به بند شود');
});

test('نقش طرفین در فرم و چاپ یکسان است و جای‌خالی در هر بخش چاپ را متوقف می‌کند', () => {
  const contract = contracts.find(({ id }) => id === 'civil-sale-movable');
  const input = emptyDraft();
  input.basics = { partyOne: 'الف', partyTwo: 'ب', subject: 'میز ⟦نوع⟧' };
  input.details = { description: 'مال مشخص' };
  input.clauses = { 0: 'فروش مال مشخص با مشخصات پیوست' };
  assert.match(contextualFieldLabel(contract, 'partyOne', BASIC_FIELDS[0].label), /فروشنده/);
  assert.match(prepareDraft(config, contract, input).basics[0].label, /فروشنده/);
  assert.equal(prepareDraft(config, contract, input).printable, false);
  input.basics.subject = 'میز مشخص';
  input.details.description = 'مال ⟦وضعیت⟧';
  assert.equal(prepareDraft(config, contract, input).printable, false);
  input.details.description = 'میز چوبی';
  input.additions = [{ id: 'extra-1', title: 'تعهد ⟦عنوان⟧', text: 'متن واقعی' }];
  assert.equal(prepareDraft(config, contract, input).printable, false);
  input.additions[0].title = 'تعهد تکمیلی';
  assert.equal(prepareDraft(config, contract, input).printable, true);
});
