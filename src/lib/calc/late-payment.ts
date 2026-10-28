/**
 * برآورد شاخصی خسارت تأخیر تأدیهٔ دیونِ وجه رایج (نه احراز استحقاق).
 * مادهٔ ۵۲۲ آ.د.م، رأی وحدت رویهٔ ۸۵۰ (نسبت دو شاخص متناظر با ماه)
 * و برای مبدأ وجه چک رأی وحدت رویهٔ ۸۱۲. اعداد شاخص باید از یک سری رسمی
 * با سال پایهٔ یکسان و به تفکیک ماه توسط کاربر تأمین شوند؛ اینجا دادهٔ حدسی نداریم.
 *
 * تمام محاسبات پولی/شاخصی با کسرهای BigInt هستند: بدون خطای ممیز شناور،
 * بدون ضرب سود در سود و با گرد کردن تنها برای نمایش/تسویه به نزدیک‌ترین ریال.
 */
import { toEnDigits, toFaDigits } from '../fa';

export type MoneyUnit = 'rial' | 'toman';
export type ClaimKind = 'ordinary' | 'check' | 'judgment';

export interface PartialPaymentInput {
  month: string; // سال/ماه شمسی
  amount: string; // به واحدِ انتخاب‌شده برای اصل دین
  index: string; // همان سری و سال پایهٔ شاخص مبدأ و مقصد
}

export interface LatePaymentInput {
  kind: ClaimKind;
  unit: MoneyUnit;
  principal: string;
  dueMonth: string;
  demandMonth: string;
  checkMonth: string;
  orderedMonth: string; // مبدأیی که صریحاً در رأی/اجراییه آمده است
  settlementMonth: string;
  baseYear: string;
  startIndex: string;
  endIndex: string;
  payments: PartialPaymentInput[];
}

export interface PaymentStep {
  month: string;
  index: string;
  paidRial: bigint;
  beforeRial: bigint;
  afterRial: bigint;
}

export interface LatePaymentResult {
  startMonth: string;
  settlementMonth: string;
  startIndex: string;
  endIndex: string;
  baseYear: string;
  principalRial: bigint;
  paidRial: bigint;
  dueRial: bigint;
  damageRial: bigint; // پرداخت‌های انجام‌شده + ماندهٔ روز محاسبه − اصل اولیه
  totalRial: bigint; // پرداخت‌های انجام‌شده + مانده
  ratio: string; // نسبت تقریبیِ شاخص مقصد به مبدأ، فقط برای نمایش
  steps: PaymentStep[];
  indexFell: boolean;
}

export type LatePaymentOutcome =
  | { ok: true; result: LatePaymentResult }
  | { ok: false; errors: string[] };

export const MAX_PARTIAL_PAYMENTS = 20;

interface Fraction { n: bigint; d: bigint }
const ONE: Fraction = { n: 1n, d: 1n };
const ZERO: Fraction = { n: 0n, d: 1n };

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function fraction(n: bigint, d: bigint): Fraction {
  if (d <= 0n) throw new Error('مخرج نامعتبر');
  if (n === 0n) return ZERO;
  const factor = gcd(n < 0n ? -n : n, d);
  return { n: n / factor, d: d / factor };
}

function times(a: Fraction, b: Fraction): Fraction { return fraction(a.n * b.n, a.d * b.d); }
function divide(a: Fraction, b: Fraction): Fraction { return fraction(a.n * b.d, a.d * b.n); }
function minus(a: Fraction, b: Fraction): Fraction { return fraction(a.n * b.d - b.n * a.d, a.d * b.d); }
function compare(a: Fraction, b: Fraction): number {
  const diff = a.n * b.d - b.n * a.d;
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}
function roundRial(a: Fraction): bigint {
  // نیم‌ریال به بالا؛ هر مرحله بدون گردکردن نگه داشته می‌شود.
  return (2n * a.n + a.d) / (2n * a.d);
}

/** ماهِ شمسیِ معتبر در بازهٔ قابل استفاده؛ روز در شاخص ماهانه نقشی ندارد. */
export function parseIranianMonth(value: string): string | null {
  const match = toEnDigits(value).trim().replace(/-/g, '/').match(/^(\d{4})\s*\/\s*(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1300 || year > 1499 || month < 1 || month > 12) return null;
  return `${year}/${String(month).padStart(2, '0')}`;
}

export function formatIranianMonth(month: string): string {
  return toFaDigits(month);
}

function monthOrder(month: string): number {
  const [year, m] = month.split('/').map(Number);
  return year * 12 + m;
}

/** جداکنندهٔ هزارگان اختیاری است؛ جداکنندهٔ اشتباه به جای حدس زدن رد می‌شود. */
function numberParts(raw: string, allowSlash: boolean, maxFraction: number): [string, string] | null {
  const text = toEnDigits(raw).trim().replace(/\u066B/g, '.').replace(/\u066C/g, ',');
  const separator = allowSlash ? '[./]' : '\\.';
  const pattern = new RegExp(`^((?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+))(?:${separator}([0-9]{1,${maxFraction}}))?$`);
  const match = text.match(pattern);
  if (!match) return null;
  const digits = match[1].replace(/,/g, '');
  if (digits.length > 30) return null;
  return [digits, match[2] ?? ''];
}

/** ورودی تومان حداکثر یک رقم اعشار (یک ریال) و ورودی ریال فقط صحیح است. */
export function parseAmountRial(raw: string, unit: MoneyUnit): bigint | null {
  if (unit !== 'rial' && unit !== 'toman') return null;
  const parts = numberParts(raw, false, 1);
  if (!parts || (unit === 'rial' && parts[1])) return null;
  const [whole, decimal] = parts;
  return BigInt(whole) * (unit === 'toman' ? 10n : 1n) + (decimal ? BigInt(decimal) : 0n);
}

/** برای تعویض واحد، مقدار ریالی حفظ می‌شود (تومانِ غیرصحیح با یک رقم اعشار). */
export function amountForInput(rial: bigint, unit: MoneyUnit): string {
  if (unit === 'rial') return rial.toString();
  const decimal = rial % 10n;
  return `${rial / 10n}${decimal ? `.${decimal}` : ''}`;
}

export function formatAmountRial(rial: bigint, unit: MoneyUnit): string {
  const whole = unit === 'toman' ? rial / 10n : rial;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const fractionDigit = unit === 'toman' && rial % 10n ? `٫${rial % 10n}` : '';
  return `${toFaDigits(grouped + fractionDigit)} ${unit === 'toman' ? 'تومان' : 'ریال'}`;
}

interface ParsedIndex { value: Fraction; label: string }
function parseIndex(raw: string): ParsedIndex | null {
  // در بسیاری از جداول فارسی «/» به جای ممیز نوشته می‌شود؛ نه عمل تقسیم.
  const parts = numberParts(raw, true, 6);
  if (!parts) return null;
  const [whole, decimals] = parts;
  const value = fraction(BigInt(whole + decimals), 10n ** BigInt(decimals.length));
  if (value.n <= 0n) return null;
  return { value, label: `${BigInt(whole)}${decimals ? `.${decimals}` : ''}` };
}

function displayRatio(indexEnd: Fraction, indexStart: Fraction): string {
  const scaled = roundRial(times(divide(indexEnd, indexStart), { n: 10_000n, d: 1n }));
  return toFaDigits(`${scaled / 10_000n}٫${String(scaled % 10_000n).padStart(4, '0')}`);
}

/**
 * پرداخت جزئی سهمی از دینِ به‌روزشده در همان ماه را تسویه می‌کند.
 * مثال: ۱۰۰ ریال، شاخص ۱۰۰ → ۱۵۰، پرداخت ۳۰ ریال = تسویهٔ ۲۰ ریال از اصل،
 * نه کسر ۳۰ ریال از اصل ۱۰۰. ماندهٔ مبنایی ۸۰ ریال است و در ماه بعد فقط همان
 * ۸۰ ریال با نسبت شاخص مبدأ به مقصد ارزش‌گذاری می‌شود (بدون سود مرکب).
 */
export function calculateLatePayment(input: LatePaymentInput): LatePaymentOutcome {
  const errors: string[] = [];
  const principal = parseAmountRial(input.principal, input.unit);
  if (principal === null || principal <= 0n) errors.push('اصل دین باید مبلغی مثبت و معتبر باشد (ریالِ صحیح یا تومان با حداکثر یک رقم اعشار).');

  let start: string | null = null;
  if (input.kind === 'ordinary') {
    const due = parseIranianMonth(input.dueMonth);
    const demand = parseIranianMonth(input.demandMonth);
    if (!due) errors.push('ماه سررسید را به صورت سال/ماه شمسی معتبر وارد کنید؛ مثلاً ۱۴۰۱/۰۴.');
    if (!demand) errors.push('ماه مطالبهٔ مستند را به صورت سال/ماه شمسی معتبر وارد کنید.');
    if (due && demand) {
      if (monthOrder(demand) < monthOrder(due)) {
        errors.push('ماه مطالبه پیش از سررسید است؛ مبدأ مطالبهٔ مؤثر را بررسی و اصلاح کنید.');
      } else start = demand;
    }
  } else if (input.kind === 'check') {
    start = parseIranianMonth(input.checkMonth);
    if (!start) errors.push('ماه مندرج در چک را به صورت سال/ماه شمسی معتبر وارد کنید.');
  } else if (input.kind === 'judgment') {
    start = parseIranianMonth(input.orderedMonth);
    if (!start) errors.push('ماه مبدأ مندرج در رأی یا اجراییه را به صورت سال/ماه شمسی معتبر وارد کنید.');
  } else errors.push('نوع مطالبه نامعتبر است.');

  const end = parseIranianMonth(input.settlementMonth);
  if (!end) errors.push('ماه پرداخت/محاسبه را به صورت سال/ماه شمسی معتبر وارد کنید.');
  if (start && end && monthOrder(end) < monthOrder(start)) errors.push('ماه پرداخت نمی‌تواند پیش از ماه مبدأ باشد.');

  const baseYear = toEnDigits(input.baseYear).trim();
  if (!/^\d{4}$/.test(baseYear) || Number(baseYear) < 1300 || Number(baseYear) > 1499) {
    errors.push('سال پایهٔ مشترکِ جدول شاخص‌ها را مشخص کنید؛ مثلاً ۱۳۹۵.');
  }
  const startIndex = parseIndex(input.startIndex);
  const endIndex = parseIndex(input.endIndex);
  if (!startIndex) errors.push('عدد شاخص ماه مبدأ باید مثبت و معتبر باشد؛ درصد تورم وارد نکنید.');
  if (!endIndex) errors.push('عدد شاخص ماه پرداخت باید مثبت و معتبر باشد؛ درصد تورم وارد نکنید.');

  if (!Array.isArray(input.payments) || input.payments.length > MAX_PARTIAL_PAYMENTS) {
    return { ok: false, errors: [`حداکثر ${toFaDigits(MAX_PARTIAL_PAYMENTS)} پرداخت میان‌دوره‌ای قابل ثبت است.`] };
  }
  const parsedPayments: { month: string; index: ParsedIndex; amount: bigint; order: number }[] = [];
  input.payments.forEach((p, i) => {
    const month = parseIranianMonth(p.month);
    const index = parseIndex(p.index);
    const amount = parseAmountRial(p.amount, input.unit);
    const label = `پرداخت شمارهٔ ${toFaDigits(i + 1)}`;
    if (!month) errors.push(`ماه ${label} معتبر نیست.`);
    else if (start && end && (monthOrder(month) < monthOrder(start) || monthOrder(month) > monthOrder(end))) {
      errors.push(`ماه ${label} باید بین مبدأ و ماه محاسبه باشد.`);
    }
    if (!index) errors.push(`شاخص ${label} باید مثبت و از همان جدول شاخص‌ها باشد.`);
    if (amount === null || amount <= 0n) errors.push(`مبلغ ${label} باید مثبت و معتبر باشد.`);
    if (month && index && amount !== null && amount > 0n) parsedPayments.push({ month, index, amount, order: i });
  });

  if (errors.length || !start || !end || !startIndex || !endIndex || principal === null) return { ok: false, errors };

  // یک ماه نمی‌تواند دو عدد شاخص متفاوت داشته باشد؛ از اشتباه در کپی/سال پایه جلوگیری می‌کند.
  const indices = new Map<string, Fraction>();
  for (const [month, index] of [
    [start, startIndex], [end, endIndex], ...parsedPayments.map((p) => [p.month, p.index] as const),
  ] as [string, ParsedIndex][]) {
    const existing = indices.get(month);
    if (existing && compare(existing, index.value) !== 0) {
      errors.push(`برای ماه ${formatIranianMonth(month)} دو شاخص متفاوت ثبت شده است؛ شاخص‌ها و سال پایه را تطبیق دهید.`);
    }
    indices.set(month, index.value);
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  parsedPayments.sort((a, b) => monthOrder(a.month) - monthOrder(b.month) || a.order - b.order);
  const originalIndex = startIndex.value;
  let remainingBase = fraction(principal, 1n);
  let paid = 0n;
  let indexFell = false;
  const steps: PaymentStep[] = [];

  for (const p of parsedPayments) {
    const actualRatio = divide(p.index.value, originalIndex);
    if (compare(actualRatio, ONE) < 0) indexFell = true;
    // کاهش شاخص نباید از اصل دین کم کند؛ نسبت کمتر از یک برای همان مرحله یک منظور می‌شود.
    const ratio = compare(actualRatio, ONE) < 0 ? ONE : actualRatio;
    const dueAtPayment = times(remainingBase, ratio);
    if (p.amount > roundRial(dueAtPayment)) {
      return { ok: false, errors: [`مبلغ پرداخت شمارهٔ ${toFaDigits(p.order + 1)} بیش از ماندهٔ به‌روزِ همان ماه است؛ پرداخت‌ها را بررسی کنید.`] };
    }
    const nextBase = minus(remainingBase, divide(fraction(p.amount, 1n), ratio));
    remainingBase = compare(nextBase, ZERO) <= 0 ? ZERO : nextBase; // تلورانس گردکردن نهایی تا نیم‌ریال
    paid += p.amount;
    steps.push({
      month: p.month,
      index: p.index.label,
      paidRial: p.amount,
      beforeRial: roundRial(dueAtPayment),
      afterRial: roundRial(times(remainingBase, ratio)),
    });
  }

  const actualEndRatio = divide(endIndex.value, originalIndex);
  if (compare(actualEndRatio, ONE) < 0) indexFell = true;
  const endRatio = compare(actualEndRatio, ONE) < 0 ? ONE : actualEndRatio;
  const dueRial = roundRial(times(remainingBase, endRatio));
  const totalRial = paid + dueRial;
  return {
    ok: true,
    result: {
      startMonth: start, settlementMonth: end,
      startIndex: startIndex.label, endIndex: endIndex.label, baseYear,
      principalRial: principal, paidRial: paid, dueRial,
      totalRial, damageRial: totalRial - principal,
      ratio: displayRatio(endIndex.value, originalIndex), steps, indexFell,
    },
  };
}
