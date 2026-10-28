/** منطق خالص محاسبه‌گر خسارت تأخیر تأدیه: تاریخ، شاخص، پول و پرداخت جزئی. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  amountForInput, calculateLatePayment, formatAmountRial, formatIranianMonth,
  parseAmountRial, parseIranianMonth, MAX_PARTIAL_PAYMENTS,
} from '../src/lib/calc/late-payment';

const form = (overrides = {}) => ({
  kind: 'ordinary', unit: 'rial', principal: '1000',
  dueMonth: '1401/01', demandMonth: '1401/02',
  checkMonth: '', orderedMonth: '', settlementMonth: '1402/01',
  baseYear: '1395', startIndex: '100', endIndex: '200', payments: [],
  ...overrides,
});

function result(input) {
  const outcome = calculateLatePayment(form(input));
  assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.errors.join(' | '));
  return outcome.result;
}
function fails(input, pattern) {
  const outcome = calculateLatePayment(form(input));
  assert.equal(outcome.ok, false);
  assert.match(outcome.errors.join(' | '), pattern);
}

test('فرمول رأی ۸۵۰: نسبت شاخص انتها به مبدأ فقط یک بار روی اصل اعمال می‌شود', () => {
  const r = result();
  assert.equal(r.startMonth, '1401/02'); // سررسید ۱۴۰۱/۰۱؛ مطالبهٔ مستند یک ماه دیرتر
  assert.equal(r.principalRial, 1000n);
  assert.equal(r.damageRial, 1000n);
  assert.equal(r.dueRial, 2000n);
  assert.equal(r.totalRial, 2000n);
  assert.equal(r.ratio, '۲٫۰۰۰۰');
});

test('مبدأ وجه چک تاریخ مندرج در چک است و شرط مطالبهٔ دین عادی به آن تحمیل نمی‌شود', () => {
  const r = result({ kind: 'check', checkMonth: '۱۴۰۱/۰۳', demandMonth: '', dueMonth: '' });
  assert.equal(r.startMonth, '1401/03');
  assert.equal(r.dueRial, 2000n);
  fails({ kind: 'check', checkMonth: '', demandMonth: '1401/03' }, /چک/);
});

test('اگر رأی مبدأ معین کرده باشد همان تاریخ وارد می‌شود، نه تاریخ چک یا مطالبه', () => {
  const r = result({ kind: 'judgment', orderedMonth: '1400/11', demandMonth: '', dueMonth: '' });
  assert.equal(r.startMonth, '1400/11');
  fails({ kind: 'judgment', orderedMonth: '' }, /رأی/);
});

test('مطالبهٔ دین عادی باید معتبر و پس از/هم‌ماه سررسید باشد', () => {
  fails({ demandMonth: '' }, /مطالبه/);
  fails({ dueMonth: '' }, /سررسید/);
  fails({ demandMonth: '1400/12' }, /پیش از سررسید/);
  assert.equal(result({ demandMonth: '1401/01' }).startMonth, '1401/01');
});

test('ماه شمسی نرمال می‌شود ولی روز یا ماه نامعتبر پذیرفته نمی‌شود', () => {
  assert.equal(parseIranianMonth(' ۱۴۰۳ / ۷ '), '1403/07');
  assert.equal(parseIranianMonth('١٤٠٣-07'), '1403/07');
  assert.equal(formatIranianMonth('1403/07'), '۱۴۰۳/۰۷');
  for (const invalid of ['1403/00', '1403/13', '1403/01/15', '1403', '1403-0', '130/01', '1500/01']) {
    assert.equal(parseIranianMonth(invalid), null, invalid);
  }
  fails({ settlementMonth: '1401/00' }, /ماه پرداخت/);
  fails({ settlementMonth: '1400/11' }, /پیش از ماه مبدأ/);
});

test('ریالِ صحیح، تومانِ یک‌دهمی، ارقام فارسی/عربی و جداکنندهٔ هزارگان دقیق‌اند', () => {
  assert.equal(parseAmountRial('۱٬۲۳۴٬۵۶۷٫۱', 'toman'), 12_345_671n);
  assert.equal(parseAmountRial('١,٢٣٤,٥٦٧.١', 'toman'), 12_345_671n);
  assert.equal(parseAmountRial('1,234', 'rial'), 1234n);
  assert.equal(amountForInput(12_345_671n, 'toman'), '1234567.1');
  assert.equal(amountForInput(12_345_671n, 'rial'), '12345671');
  assert.equal(formatAmountRial(12_345_671n, 'toman'), '۱٬۲۳۴٬۵۶۷٫۱ تومان');
  assert.equal(formatAmountRial(12_345_671n, 'rial'), '۱۲٬۳۴۵٬۶۷۱ ریال');
  for (const invalid of ['1,23', '1.2', '1e5', '-100', '100 ریال', 'NaN', 'Infinity', '']) {
    assert.equal(parseAmountRial(invalid, 'rial'), null, invalid);
  }
  assert.equal(parseAmountRial('1.23', 'toman'), null, 'کمتر از یک ریال قابل ورود نیست');
  fails({ principal: '-10' }, /اصل دین/);
  fails({ principal: '0' }, /اصل دین/);
  assert.equal(result({ unit: 'toman', principal: '۱۰٫۱', startIndex: '100', endIndex: '100' }).dueRial, 101n);
});

test('شاخص‌ها عدد مثبت‌اند؛ درصد، ممیز بیش از شش رقم و تقسیم بر صفر مجاز نیست', () => {
  const r = result({ startIndex: '۱۰۰/۵', endIndex: '۲۰۱٫۰' });
  assert.equal(r.dueRial, 2000n);
  for (const bad of ['', '0', '-2', '15%', 'NaN', '2e2', '2.0000001', '1,23']) {
    fails({ startIndex: bad }, /شاخص ماه مبدأ/);
  }
  fails({ endIndex: '' }, /شاخص ماه پرداخت/);
  fails({ baseYear: '' }, /سال پایه/);
  fails({ baseYear: '1500' }, /سال پایه/);
});

test('شاخص‌های یک ماه (مبدأ، مقصد یا پرداخت جزئی) باید برابر باشند', () => {
  fails({ settlementMonth: '1401/02', endIndex: '101' }, /دو شاخص متفاوت/);
  const r = result({ settlementMonth: '1401/02', endIndex: '100' });
  assert.equal(r.dueRial, 1000n);
  assert.equal(r.damageRial, 0n);
  fails({ payments: [{ month: '1401/02', amount: '100', index: '101' }] }, /دو شاخص متفاوت/);
  fails({ payments: [
    { month: '1401/08', amount: '10', index: '150' },
    { month: '1401/08', amount: '10', index: '150.1' },
  ] }, /دو شاخص متفاوت/);
});

test('فاصلهٔ کوتاه‌تر از ماه دقت کاذب ندارد؛ گردکردن در انتها به نزدیک‌ترین ریال است', () => {
  assert.equal(result({ settlementMonth: '1401/02', endIndex: '100' }).damageRial, 0n);
  assert.equal(result({ principal: '1', startIndex: '2', endIndex: '3' }).dueRial, 2n); // ۱٫۵ → ۲
  assert.equal(result({ principal: '1', startIndex: '3', endIndex: '4' }).dueRial, 1n); // ۱٫۳۳ → ۱
  assert.equal(result({ principal: '3', startIndex: '2', endIndex: '3' }).dueRial, 5n); // ۴٫۵ → ۵
});

test('بیش از حد عدد امنِ Number هم بدون کاهش دقت محاسبه می‌شود', () => {
  const principal = 90_071_992_547_409_937_123_456n;
  const r = result({ principal: principal.toString(), startIndex: '100.1', endIndex: '133.3' });
  const expected = (2n * principal * 1333n + 1001n) / (2n * 1001n);
  assert.equal(r.dueRial, expected);
  assert.equal(r.damageRial, expected - principal);
});

test('در کاهش شاخص، اصل دین کم نمی‌شود و خسارت منفی ساخته نمی‌شود', () => {
  const r = result({ endIndex: '90' });
  assert.equal(r.indexFell, true);
  assert.equal(r.dueRial, 1000n);
  assert.equal(r.damageRial, 0n);
});

test('پرداخت جزئی از دینِ شاخص‌خوردهٔ همان ماه کسر می‌شود، نه یک‌سره از اصل', () => {
  const r = result({ payments: [{ month: '1401/08', amount: '300', index: '150' }] });
  assert.deepEqual([r.steps[0].beforeRial, r.steps[0].paidRial, r.steps[0].afterRial], [1500n, 300n, 1200n]);
  assert.equal(r.paidRial, 300n);
  assert.equal(r.dueRial, 1600n); // ۸۰۰ ریال از اصل هنوز تسویه نشده، × ۲
  assert.equal(r.totalRial, 1900n);
  assert.equal(r.damageRial, 900n);
});

test('چند پرداخت نامرتب زمانی مرتب می‌شوند؛ تسویه کامل خسارت بعدی تولید نمی‌کند', () => {
  const payments = [
    { month: '1401/10', amount: '400', index: '200' },
    { month: '1401/08', amount: '300', index: '150' },
  ];
  const r = result({ settlementMonth: '1402/01', endIndex: '250', payments });
  assert.deepEqual(r.steps.map((p) => p.month), ['1401/08', '1401/10']);
  assert.equal(r.dueRial, 1500n); // ۱۰۰۰ - ۳۰۰/۱٫۵ - ۴۰۰/۲ = ۶۰۰؛ × ۲٫۵
  assert.equal(r.damageRial, 1200n); // ۳۰۰+۴۰۰+۱۵۰۰−۱۰۰۰
  const full = result({ payments: [{ month: '1401/08', amount: '1500', index: '150' }] });
  assert.equal(full.dueRial, 0n);
  assert.equal(full.damageRial, 500n);
});

test('در نوسان نزولی نیز پرداخت به اصلِ بدهی بیش از سهم واقعی اعتبار نمی‌دهد', () => {
  const r = result({ principal: '100', payments: [{ month: '1401/08', amount: '50', index: '80' }], endIndex: '120' });
  assert.equal(r.dueRial, 60n); // تا ماه کاهش، ۵۰ از اصل کم می‌شود؛ ۵۰ × ۱٫۲
  assert.equal(r.damageRial, 10n);
});

test('پرداخت‌های خارج از دوره، بیشتر از بدهی، صفر و بی‌شاخص رد می‌شوند', () => {
  fails({ payments: [{ month: '1400/12', index: '100', amount: '10' }] }, /بین مبدأ و ماه محاسبه/);
  fails({ payments: [{ month: '1402/02', index: '200', amount: '10' }] }, /بین مبدأ و ماه محاسبه/);
  fails({ payments: [{ month: '1401/08', index: '150', amount: '1501' }] }, /بیش از مانده/);
  fails({ payments: [{ month: '1401/08', index: '150', amount: '0' }] }, /مبلغ پرداخت شماره/);
  fails({ payments: [{ month: '1401/08', index: '', amount: '10' }] }, /شاخص پرداخت شماره/);
  fails({ payments: [{ month: '1401/08', index: '150', amount: '1500' }, { month: '1401/10', index: '180', amount: '1' }] }, /بیش از مانده/);
  fails({ payments: Array.from({ length: MAX_PARTIAL_PAYMENTS + 1 }, () => ({ month: '1401/08', index: '150', amount: '1' })) }, /حداکثر/);
});

test('ریز پرداخت‌ها بدون گردکردن‌های پیاپی محاسبه می‌شوند', () => {
  const r = result({ principal: '10', startIndex: '3', endIndex: '5', payments: [
    { month: '1401/05', index: '4', amount: '1' },
    { month: '1401/06', index: '4', amount: '1' },
  ] });
  // اصلِ تسویه‌شده در هر پرداخت ۳/۴ ریال است: ماندهٔ مبنایی ۸٫۵ ریال؛ × ۵/۳ = ۱۴٫۱۶۶… → ۱۴
  assert.equal(r.dueRial, 14n);
  assert.equal(r.totalRial, 16n);
  assert.equal(r.damageRial, 6n);
});

test('حد مجاز پرداخت‌های متعدد بدون تجاوز از مانده با دقت کسری می‌ماند', () => {
  const payments = Array.from({ length: MAX_PARTIAL_PAYMENTS }, (_, i) => ({
    month: `1401/${String(i % 11 + 2).padStart(2, '0')}`,
    index: '100', amount: '1',
  }));
  const r = result({ settlementMonth: '1402/01', endIndex: '100', payments });
  assert.equal(r.steps.length, MAX_PARTIAL_PAYMENTS);
  assert.equal(r.paidRial, 20n);
  assert.equal(r.dueRial, 980n);
  assert.equal(r.damageRial, 0n);
});

test('ارجاع‌های قانونی صفحه به مواد و آرای موجود در نسخهٔ دادهٔ برنامه وصل هستند', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src/app/calculator/late-payment/page.tsx'), 'utf8');
  const pointer = JSON.parse(fs.readFileSync(path.join(root, 'public/data/version.json'), 'utf8'));
  const legalIds = [
    'civil-procedure-code-522', 'supreme-court-precedents-551',
    'supreme-court-precedents-626', 'civil-code-1082',
  ];
  for (const id of legalIds) {
    assert.ok(source.includes(`/article/${id}`), `لینک ${id} روی صفحه نیست`);
    const lawId = id.replace(/-\d+$/, '');
    const law = pointer.laws.find((row) => row.id === lawId);
    assert.ok(law, `قانون ${lawId} وجود ندارد`);
    const found = law.parts.some((part) => {
      const file = path.join(root, 'public', part.path.replace(/^\//, ''));
      return JSON.parse(fs.readFileSync(file, 'utf8')).articles.some((article) => article.id === id);
    });
    assert.ok(found, `مستند ${id} در دادهٔ منتشرشده یافت نشد`);
  }
});
