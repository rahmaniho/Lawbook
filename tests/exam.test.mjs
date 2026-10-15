/**
 * آزمون‌های «آزمون اختبار» — بانک سوالات، توزیع ۱۰۰ آزمون، منطق انتخاب
 * سوال، محاسبهٔ نمره، تایمر و ذخیره‌سازی.
 *
 * منطق خالص (بدون DOM) است؛ برای storage یک localStorage ساختگی تزریق
 * می‌شود.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/* یک localStorage ساختگی برای ماژول storage */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const memoryStorage = new MemoryStorage();
globalThis.window = { localStorage: memoryStorage };

const { EXAM_CATEGORIES, TOTAL_EXAMS, getCategory } = await import('../src/lib/exam/categories');
const {
  EXAMS, getExam, pickQuestions, computeScore, formatClock, scoreMessage,
  shuffle, requiredQuestionCount, bankStats,
} = await import('../src/lib/exam/exams');
const { QUESTION_BANK, questionsOfCategory, questionById } = await import('../src/lib/exam/questions');
const {
  loadExamState, saveExamState, clearExamState, loadHistory, recordAttempt, clearAllExamData,
} = await import('../src/lib/exam/storage');
const { EXAM_DIFFICULTIES } = await import('../src/lib/exam/difficulties');

/* ------------------------------------------------------------------ *
 * جدول توزیع دسته‌ها
 * ------------------------------------------------------------------ */

test('جدول توزیع: دقیقاً ۹ دسته و مجموع ۱۰۰ آزمون', () => {
  assert.equal(EXAM_CATEGORIES.length, 9);
  assert.equal(TOTAL_EXAMS, 100);
});

test('جدول توزیع مطابق خواستهٔ کاربر است', () => {
  const expected = {
    civil: 20, 'civil-procedure': 15, commercial: 15, criminal: 15,
    'criminal-procedure': 10, registration: 10, fiqh: 5, constitutional: 5, probate: 5,
  };
  for (const cat of EXAM_CATEGORIES) {
    assert.equal(cat.examCount, expected[cat.id], `تعداد آزمون ${cat.id}`);
    assert.equal(cat.questionsPerExam, 5, `سوال هر آزمون ${cat.id}`);
    assert.equal(cat.durationMinutes, 30, `زمان ${cat.id}`);
  }
});

/* ------------------------------------------------------------------ *
 * فهرست ۱۰۰ آزمون
 * ------------------------------------------------------------------ */

test('فهرست EXAMS دقیقاً ۱۰۰ آزمون یکتاست', () => {
  assert.equal(EXAMS.length, 100);
  assert.equal(new Set(EXAMS.map((e) => e.id)).size, 100);
});

test('شناسه و عنوان آزمون‌ها طبق الگوست (مانند civil-1)', () => {
  for (const cat of EXAM_CATEGORIES) {
    const list = EXAMS.filter((e) => e.category === cat.id);
    assert.equal(list.length, cat.examCount);
    list.forEach((exam, i) => {
      assert.equal(exam.id, `${cat.id}-${i + 1}`);
      assert.equal(exam.series, i + 1);
      assert.ok(exam.title.includes(cat.title), `عنوان شامل نام دسته: ${exam.title}`);
      assert.ok(exam.title.includes(`سری ${new Intl.NumberFormat('fa-IR').format(i + 1)}`) || /سری/.test(exam.title));
    });
  }
  assert.equal(getExam('civil-1')?.category, 'civil');
  assert.equal(getExam('nobody-9'), undefined);
});

/* ------------------------------------------------------------------ *
 * بانک سوالات
 * ------------------------------------------------------------------ */

test('بانک سوالات دست‌کم ۵۰۰ سوال دارد', () => {
  assert.ok(QUESTION_BANK.length >= 500, `مجموع سوالات: ${QUESTION_BANK.length}`);
});

test('شناسهٔ سوالات پیوسته و پایدار است (۱ تا N)', () => {
  QUESTION_BANK.forEach((q, i) => assert.equal(q.id, i + 1));
  assert.equal(new Set(QUESTION_BANK.map((q) => q.id)).size, QUESTION_BANK.length);
  assert.equal(questionById(1)?.id, 1);
  assert.equal(questionById(QUESTION_BANK.length + 1), undefined);
});

test('هر دسته سوال کافی برای همهٔ سری‌های خودش را دارد', () => {
  for (const cat of EXAM_CATEGORIES) {
    const n = questionsOfCategory(cat.id).length;
    assert.ok(
      n >= requiredQuestionCount(cat),
      `${cat.id}: ${n} سوال < ${requiredQuestionCount(cat)} لازم`,
    );
  }
});

test('ساختار هر سوال معتبر است (۴ گزینهٔ یکتا، پاسخ، دشواری، مستند)', () => {
  const validCategories = new Set(EXAM_CATEGORIES.map((c) => c.id));
  for (const q of QUESTION_BANK) {
    assert.ok(validCategories.has(q.category), `دستهٔ نامعتبر: ${q.category}`);
    assert.ok(typeof q.question === 'string' && q.question.trim().length > 5, `سوال خالی در id=${q.id}`);
    assert.ok(Array.isArray(q.options) && q.options.length === 4, `گزینه‌ها != ۴ در id=${q.id}`);
    assert.equal(new Set(q.options).size, 4, `گزینهٔ تکراری در id=${q.id}`);
    q.options.forEach((o, i) => assert.ok(typeof o === 'string' && o.trim().length > 0, `گزینهٔ خالی ${i} در id=${q.id}`));
    assert.ok(Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer <= 3, `پاسخ خارج از دامنه در id=${q.id}`);
    assert.ok(EXAM_DIFFICULTIES.includes(q.difficulty), `دشواری نامعتبر «${q.difficulty}» در id=${q.id}`);
    assert.ok(typeof q.source === 'string' && q.source.trim().length > 2, `بدون مستند در id=${q.id}`);
  }
});

test('پاسخ صحیح در گزینه‌ها پراکنده است (هیچ گزینه‌ای کمتر از ۱۵٪)', () => {
  const dist = [0, 0, 0, 0];
  for (const q of QUESTION_BANK) dist[q.correctAnswer] += 1;
  const min = Math.min(...dist);
  assert.ok(min / QUESTION_BANK.length >= 0.15, `توزیع گزینه‌ها: ${dist.join(', ')}`);
});

test('سطح دشواری سوالات متنوع است', () => {
  const set = new Set(QUESTION_BANK.map((q) => q.difficulty));
  for (const d of EXAM_DIFFICULTIES) assert.ok(set.has(d), `سطح «${d}» در بانک نیست`);
});

test('bankStats مجموع و تفکیک درست را می‌دهد', () => {
  const stats = bankStats();
  assert.equal(stats.total, QUESTION_BANK.length);
  for (const cat of EXAM_CATEGORIES) {
    assert.equal(stats.byCategory[cat.id], questionsOfCategory(cat.id).length);
  }
});

/* ------------------------------------------------------------------ *
 * انتخاب سوال و نمره
 * ------------------------------------------------------------------ */

test('pickQuestions پنج سوال بدون تکرار از همان دسته می‌دهد', () => {
  for (const cat of EXAM_CATEGORIES) {
    for (let i = 0; i < 20; i++) {
      const picked = pickQuestions(cat.id, 5);
      assert.equal(picked.length, 5, `${cat.id}`);
      assert.equal(new Set(picked.map((q) => q.id)).size, 5, `${cat.id}: تکرار در یک آزمون`);
      picked.forEach((q) => assert.equal(q.category, cat.id, `${cat.id}: سوال از دستهٔ دیگر`));
    }
  }
});

test('pickQuestions با شانس مساوی هم بدون تکرار است (random ثابت)', () => {
  const alwaysHalf = () => 0.999;
  const picked = pickQuestions('civil', 5, alwaysHalf);
  assert.equal(new Set(picked.map((q) => q.id)).size, picked.length);
});

test('pickQuestions وقتی دسته سوال کمتر دارد، همهٔ موجود را برمی‌گرداند', () => {
  const small = { id: 'fiqh', examCount: 5, questionsPerExam: 5 };
  const pool = questionsOfCategory('fiqh');
  assert.ok(pool.length >= requiredQuestionCount(small));
});

test('shuffle آرایهٔ اصلی را تغییر نمی‌دهد و عناصر را حفظ می‌کند', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = shuffle(src, () => 0.42);
  assert.deepEqual([...src].sort(), [...copy].sort());
  assert.notEqual(src, copy);
});

test('computeScore درست محاسبه می‌کند', () => {
  const qs = QUESTION_BANK.slice(0, 5);
  const allCorrect = qs.map((q) => q.correctAnswer);
  const none = [null, null, null, null, null];
  const two = qs.map((q, i) => (i < 2 ? q.correctAnswer : null));
  assert.deepEqual(computeScore(qs, allCorrect), { correct: 5, total: 5, percent: 100, message: scoreMessage(100) });
  assert.equal(computeScore(qs, none).percent, 0);
  assert.equal(computeScore(qs, two).correct, 2);
  assert.equal(computeScore(qs, two).percent, 40);
  assert.deepEqual(computeScore([], []), { correct: 0, total: 0, percent: 0, message: scoreMessage(0) });
});

test('پیام نمره با درصد متناسب است', () => {
  assert.match(scoreMessage(100), /عالی/);
  assert.match(scoreMessage(90), /عالی/);
  assert.match(scoreMessage(89), /خوب/);
  assert.match(scoreMessage(70), /خوب/);
  assert.match(scoreMessage(69), /متوسط/);
  assert.match(scoreMessage(50), /متوسط/);
  assert.match(scoreMessage(49), /مطالعه بیشتر|تلاش/);
});

test('formatClock زمان را با ارقام فارسی و قالب mm:ss می‌دهد', () => {
  assert.equal(formatClock(1800), '۳۰:۰۰');
  assert.equal(formatClock(65), '۰۱:۰۵');
  assert.equal(formatClock(0), '۰۰:۰۰');
  assert.equal(formatClock(-5), '۰۰:۰۰');
  assert.equal(formatClock(599), '۰۹:۵۹');
});

/* ------------------------------------------------------------------ *
 * ذخیره‌سازی (localStorage ساختگی)
 * ------------------------------------------------------------------ */

function fakeState(examId, deadlineTs = Date.now() + 60_000) {
  return {
    examId,
    questionIds: [1, 2, 3, 4, 5],
    answers: [null, null, null, null, null],
    currentIndex: 2,
    startedAt: Date.now() - 5_000,
    deadlineTs,
  };
}

test('ذخیره و بازیابی وضعیت آزمون در جریان', () => {
  const state = fakeState('civil-3');
  saveExamState(state);
  assert.deepEqual(loadExamState('civil-3'), state);
  assert.equal(loadExamState('civil-4'), undefined);
  clearExamState('civil-3');
  assert.equal(loadExamState('civil-3'), undefined);
});

test('دادهٔ خراب وضعیت به undefined تبدیل می‌شود', () => {
  memoryStorage.setItem('exam-state:criminal-1', '{not json');
  assert.equal(loadExamState('criminal-1'), undefined);
  memoryStorage.setItem('exam-state:criminal-2', JSON.stringify({ examId: 'other' }));
  assert.equal(loadExamState('criminal-2'), undefined);
});

test('تاریخچه بهترین درصد و تعداد تلاش را نگه می‌دارد', () => {
  recordAttempt('civil-1', 40, 1000);
  recordAttempt('civil-1', 80, 2000);
  recordAttempt('civil-1', 60, 3000);
  const h = loadHistory();
  assert.equal(h['civil-1'].bestPercent, 80);
  assert.equal(h['civil-1'].lastPercent, 60);
  assert.equal(h['civil-1'].attempts, 3);
  assert.equal(h['civil-1'].lastAt, 3000);
});

test('clearAllExamData همهٔ کلیدهای آزمون را پاک می‌کند', () => {
  saveExamState(fakeState('probate-2'));
  recordAttempt('fiqh-1', 100);
  clearAllExamData();
  assert.deepEqual(loadHistory(), {});
  assert.equal(loadExamState('probate-2'), undefined);
});

test('storage بدون window خطا نمی‌دهد', async () => {
  const prevWindow = globalThis.window;
  delete globalThis.window;
  const fresh = await import('../src/lib/exam/storage');
  assert.equal(fresh.loadExamState('civil-1'), undefined);
  assert.deepEqual(fresh.loadHistory(), {});
  fresh.saveExamState(fakeState('civil-9'));
  fresh.recordAttempt('civil-9', 50);
  globalThis.window = prevWindow;
  assert.equal(memoryStorage.getItem('exam-state:civil-9'), null, 'بدون window نباید چیزی نوشته شود');
});

/* ------------------------------------------------------------------ *
 * قید مستقیم مواد کلیدی (نمونهٔ صحت حقوقی)
 * ------------------------------------------------------------------ */

test('نمونه‌های مستند بانک با مواد درست تنظیم شده‌اند', () => {
  const bySource = (needle) => QUESTION_BANK.find((q) => q.source.includes(needle));
  assert.ok(bySource('ماده ۱۹۰ قانون مدنی'), 'سوال ماده ۱۹۰ (شرایط اساسی صحت قرارداد)');
  const shf = QUESTION_BANK.find((q) => q.source.includes('ماده ۹۱۵'));
  assert.ok(shf, 'سوال حبوه/ماده ۹۱۵');
  assert.ok(QUESTION_BANK.some((q) => q.source.includes('لایحه اصلاحی')), 'استناد به لایحه اصلاحی تجارت');
  assert.ok(QUESTION_BANK.some((q) => q.source.includes('قانون صدور چک')), 'استناد به قانون صدور چک');
  assert.ok(QUESTION_BANK.some((q) => q.source.includes('قانون آیین دادرسی کیفری')), 'استناد به آیین دادرسی کیفری');
  assert.ok(QUESTION_BANK.some((q) => q.source.includes('قانون ثبت')), 'استناد به قانون ثبت');
  assert.ok(QUESTION_BANK.some((q) => q.source.includes('قانون اساسی')), 'استناد به قانون اساسی');
  assert.ok(getCategory('civil')?.title.includes('مدنی'));
});
