/**
 * برآورد شاخصی خسارت تأخیر تأدیهٔ دین وجه رایج؛ نه احراز استحقاق.
 * مادهٔ ۵۲۲ آ.د.م، رأی وحدت رویهٔ ۸۵۰ و برای مبدأ چک رأی ۸۱۲.
 * شاخص ماهانه باید از یک سری رسمی و سال پایهٔ یکسان توسط کاربر وارد شود.
 * محاسبهٔ پول با کسرهای BigInt است؛ هیچ نرخ ثابت یا سود مرکبی اعمال نمی‌شود.
 */
import jalaali from 'jalaali-js';
import { toEnDigits, toFaDigits } from '../fa';

export type MoneyUnit = 'rial' | 'toman';
export type ClaimKind = 'ordinary' | 'check' | 'judgment';

export interface PartialPaymentInput {
  month: string; // سال/ماه[/روز] شمسی؛ شاخص مربوط به همان ماه است
  amount: string; // به واحدِ انتخاب‌شده برای اصل دین
  index: string; // اگر ماهِ مبدأ/مقصد باشد، می‌توان خالی گذاشت
}

export interface LatePaymentInput {
  kind: ClaimKind;
  unit: MoneyUnit;
  principal: string;
  dueMonth: string; // سال/ماه[/روز] شمسی؛ نام فیلد برای سازگاری نگه داشته شده
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
  date: string;
  month: string;
  index: string;
  paidRial: bigint;
  beforeRial: bigint;
  afterRial: bigint;
  remainingPrincipalRial: bigint; // نمایش گرد‌شدهٔ ماندهٔ مبنایی
}

export interface LatePaymentResult {
  startDate: string; // تاریخ یا ماه نرمال‌شدهٔ ورودی؛ روزِ ناموجود حدس زده نمی‌شود
  startMonth: string; // ماه شاخص
  settlementDate: string;
  settlementMonth: string;
  startIndex: string;
  endIndex: string;
  baseYear: string;
  principalRial: bigint;
  paidRial: bigint;
  dueRial: bigint;
  remainingPrincipalRial: bigint;
  remainingDamageRial: bigint;
  paidDamageRial: bigint;
  damageRial: bigint; // پرداخت‌های انجام‌شده + ماندهٔ روز محاسبه − اصل اولیه
  totalRial: bigint; // پرداخت‌های انجام‌شده + مانده
  ratio: string; // نسبت تقریبیِ شاخص مقصد به مبدأ، فقط برای نمایش
  steps: PaymentStep[];
  indexFell: boolean;
  datePrecisionWarning: boolean;
}

export type LatePaymentOutcome =
  | { ok: true; result: LatePaymentResult }
  | { ok: false; errors: string[]; fieldErrors: Record<string, string> };

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
  // نیم‌ریال به بالا؛ در میانهٔ محاسبه از مقدار دقیق استفاده می‌شود.
  return (2n * a.n + a.d) / (2n * a.d);
}

export interface IranianDate { month: string; day: number | null; label: string }

/** تاریخ کامل یا ماه شمسی؛ روز فقط برای ترتیب زمانی به کار می‌رود، نه کسر ماه. */
export function parseIranianDate(value: string): IranianDate | null {
  const text = toEnDigits(value).trim().replace(/\s*-\s*/g, '/');
  // با صفحه‌کلید عددی موبایل می‌توان ۱۴۰۳۰۱۱۵ یا ۱۴۰۳۰۱ را بدون «/» وارد کرد.
  const match = text.match(/^(\d{4})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?$/)
    ?? text.match(/^(\d{4})(\d{2})(\d{2})?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] === undefined ? null : Number(match[3]);
  if (year < 1300 || year > 1499 || !jalaali.isValidJalaaliDate(year, month, day ?? 1)) return null;
  const normalizedMonth = `${year}/${String(month).padStart(2, '0')}`;
  return { month: normalizedMonth, day, label: day === null ? normalizedMonth : `${normalizedMonth}/${String(day).padStart(2, '0')}` };
}

/** برای مواردی که دقیقاً ماه لازم است؛ روز را به‌اشتباه نادیده نمی‌گیرد. */
export function parseIranianMonth(value: string): string | null {
  const parsed = parseIranianDate(value);
  return parsed && parsed.day === null ? parsed.month : null;
}

export function formatIranianMonth(month: string): string { return toFaDigits(month); }
export function formatIranianDate(date: string): string { return toFaDigits(date); }

function monthOrder(month: string): number {
  const [year, m] = month.split('/').map(Number);
  return year * 12 + m;
}

/** روز مجهول را حدس نمی‌زنیم؛ در ماه یکسان فقط روزهای معلوم قابل مقایسه‌اند. */
export function compareIranianDates(a: IranianDate, b: IranianDate): number {
  const diff = monthOrder(a.month) - monthOrder(b.month);
  return diff || (a.day !== null && b.day !== null ? a.day - b.day : 0);
}
function ambiguousSameMonth(a: IranianDate, b: IranianDate): boolean {
  return a.month === b.month && (a.day === null || b.day === null);
}

/** گروه‌بندی سه‌تایی با ویرگول یا فاصله؛ گروه‌بندی معیوب به جای حدس رد می‌شود. */
function numberParts(raw: string, allowSlash: boolean, maxFraction: number): [string, string] | null {
  const text = toEnDigits(raw).trim()
    .replace(/[\u00a0\u2007\u2009\u202f]/g, ' ')
    .replace(/\u066B/g, '.').replace(/\u066C/g, ',');
  const separator = allowSlash ? '[./]' : '\\.';
  const whole = '(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{1,3}(?: [0-9]{3})+)';
  const pattern = new RegExp(`^(${whole})(?:${separator}([0-9]{1,${maxFraction}}))?$`);
  const match = text.match(pattern);
  if (!match) return null;
  const digits = match[1].replace(/[, ]/g, '');
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

interface Issue { field: string; message: string }
function invalid(issues: Issue[]): LatePaymentOutcome {
  const errors = [...new Set(issues.map((issue) => issue.message))];
  const fieldErrors: Record<string, string> = {};
  for (const { field, message } of issues) if (!fieldErrors[field]) fieldErrors[field] = message;
  return { ok: false, errors, fieldErrors };
}

/**
 * پرداخت جزئی سهمی از دینِ به‌روزشده در همان ماه را تسویه می‌کند؛
 * از مبنای اصل، فقط معادل ارزش مبنایی پرداخت کم می‌شود. به عنوان مثال
 * اصل ۱۰۰ با شاخص ۱۰۰، در شاخص ۱۵۰ با پرداخت ۳۰ به ماندهٔ مبنایی ۸۰ می‌رسد.
 * این صرفاً فرض ریاضیِ تخصیص پرداخت در اجرای حکم است، نه تعیین استحقاق حقوقی.
 */
export function calculateLatePayment(input: LatePaymentInput): LatePaymentOutcome {
  const issues: Issue[] = [];
  const issue = (field: string, message: string) => issues.push({ field, message });
  const principal = parseAmountRial(input.principal, input.unit);
  if (principal === null || principal <= 0n) issue('principal', 'اصل دین باید مبلغی مثبت و معتبر باشد (ریالِ صحیح یا تومان با حداکثر یک رقم اعشار).');

  let start: IranianDate | null = null;
  let due: IranianDate | null = null;
  if (input.kind === 'ordinary') {
    due = parseIranianDate(input.dueMonth);
    const demand = parseIranianDate(input.demandMonth);
    if (!due) issue('dueMonth', 'ماه سررسید یا تاریخ کامل آن را به‌شکل سال/ماه یا سال/ماه/روز شمسی (یا ارقام پیوسته) وارد کنید؛ مثلاً ۱۴۰۳/۰۱/۱۵.');
    if (!demand) issue('demandMonth', 'ماه مطالبهٔ مستند یا تاریخ کامل آن را به‌شکل سال/ماه یا سال/ماه/روز شمسی (یا ارقام پیوسته) وارد کنید.');
    if (due && demand) {
      if (compareIranianDates(demand, due) < 0) issue('demandMonth', 'تاریخ مطالبه پیش از سررسید است؛ مبدأ مطالبهٔ مؤثر را بررسی کنید.');
      else start = demand;
    }
  } else if (input.kind === 'check') {
    start = parseIranianDate(input.checkMonth);
    if (!start) issue('checkMonth', 'ماه تاریخ مندرج در چک یا تاریخ کامل آن را به‌شکل سال/ماه یا سال/ماه/روز شمسی (یا ارقام پیوسته) وارد کنید.');
  } else if (input.kind === 'judgment') {
    start = parseIranianDate(input.orderedMonth);
    if (!start) issue('orderedMonth', 'ماه مبدأ مندرج در رأی یا اجراییه یا تاریخ کامل آن را به‌شکل سال/ماه یا سال/ماه/روز شمسی (یا ارقام پیوسته) وارد کنید.');
  } else issue('kind', 'نوع مطالبه نامعتبر است.');

  const end = parseIranianDate(input.settlementMonth);
  if (!end) issue('settlementMonth', 'ماه پرداخت/محاسبه یا تاریخ کامل آن را به‌شکل سال/ماه یا سال/ماه/روز شمسی (یا ارقام پیوسته) وارد کنید.');
  if (start && end && compareIranianDates(end, start) < 0) issue('settlementMonth', 'تاریخ یا ماه پرداخت نمی‌تواند پیش از ماه مبدأ باشد.');

  const baseYear = toEnDigits(input.baseYear).trim();
  if (!/^\d{4}$/.test(baseYear) || Number(baseYear) < 1300 || Number(baseYear) > 1499) {
    issue('baseYear', 'سال پایهٔ مشترکِ جدول شاخص‌ها را مشخص کنید؛ مثلاً ۱۴۰۰.');
  }
  const startIndex = parseIndex(input.startIndex);
  const endIndex = parseIndex(input.endIndex);
  if (!startIndex) issue('startIndex', 'عدد شاخص ماه مبدأ باید مثبت و معتبر باشد؛ درصد تورم وارد نکنید.');
  if (!endIndex) issue('endIndex', 'عدد شاخص ماه پرداخت باید مثبت و معتبر باشد؛ درصد تورم وارد نکنید.');

  if (!Array.isArray(input.payments) || input.payments.length > MAX_PARTIAL_PAYMENTS) {
    issue('payments', `حداکثر ${toFaDigits(MAX_PARTIAL_PAYMENTS)} پرداخت میان‌دوره‌ای قابل ثبت است.`);
    return invalid(issues);
  }
  const parsedPayments: { date: IranianDate; index: ParsedIndex; amount: bigint; order: number }[] = [];
  input.payments.forEach((p, i) => {
    const date = parseIranianDate(p.month);
    let index = parseIndex(p.index);
    const amount = parseAmountRial(p.amount, input.unit);
    const label = `پرداخت شمارهٔ ${toFaDigits(i + 1)}`;
    if (!date) issue(`payments.${i}.month`, `ماه ${label} یا تاریخ کامل آن معتبر نیست.`);
    else if (start && end && (compareIranianDates(date, start) < 0 || compareIranianDates(date, end) > 0)) {
      issue(`payments.${i}.month`, `ماه ${label} باید بین مبدأ و ماه محاسبه باشد؛ ترتیب روزهای معلوم هم کنترل می‌شود.`);
    }
    // در ماهِ مبدأ/مقصد، تکرار شاخص لازم نیست؛ ورودیِ متفاوت همچنان خطاست.
    if (!index && !p.index.trim() && date) {
      if (start && date.month === start.month) index = startIndex;
      else if (end && date.month === end.month) index = endIndex;
    }
    if (!index) issue(`payments.${i}.index`, `شاخص ${label} باید مثبت و از همان جدول شاخص‌ها باشد.`);
    if (amount === null || amount <= 0n) issue(`payments.${i}.amount`, `مبلغ ${label} باید مثبت و معتبر باشد.`);
    if (date && index && amount !== null && amount > 0n) parsedPayments.push({ date, index, amount, order: i });
  });

  if (issues.length || !start || !end || !startIndex || !endIndex || principal === null) return invalid(issues);

  // دو عدد متفاوت برای یک ماه معمولاً نشان‌دهندهٔ جابه‌جایی ماه یا سال پایه است.
  const indices = new Map<string, Fraction>();
  const indexEntries = [
    { date: start, index: startIndex, field: 'startIndex' },
    { date: end, index: endIndex, field: 'endIndex' },
    ...parsedPayments.map((p) => ({ date: p.date, index: p.index, field: `payments.${p.order}.index` })),
  ];
  for (const { date, index, field } of indexEntries) {
    const previous = indices.get(date.month);
    if (previous && compare(previous, index.value) !== 0) {
      issue(field, `برای ماه ${formatIranianMonth(date.month)} دو شاخص متفاوت ثبت شده است؛ شاخص‌ها و سال پایه را تطبیق دهید.`);
    } else indices.set(date.month, index.value);
  }
  if (issues.length) return invalid(issues);

  // در یک ماه روزهای معلوم به ترتیب‌اند؛ روزِ نامعلوم فقط در گزارش بعد از آنها
  // می‌آید و روزی برایش فرض نمی‌شود. شاخص هم‌ماه یکسان است، پس مبلغ نهایی مستقل
  // از ترتیب این پرداخت‌هاست؛ ابهام ترتیب با هشدار گزارش می‌شود.
  parsedPayments.sort((a, b) => monthOrder(a.date.month) - monthOrder(b.date.month)
    || (a.date.day ?? 32) - (b.date.day ?? 32) || a.order - b.order);
  const originalIndex = startIndex.value;
  let remainingBase = fraction(principal, 1n);
  let paid = 0n;
  let indexFell = false;
  const steps: PaymentStep[] = [];

  for (const p of parsedPayments) {
    const actualRatio = divide(p.index.value, originalIndex);
    if (compare(actualRatio, ONE) < 0) indexFell = true;
    // کاهش شاخص نباید اصل دین را کاهش دهد؛ ضریب همین مرحله حداقل ۱ است.
    const ratio = compare(actualRatio, ONE) < 0 ? ONE : actualRatio;
    const dueAtPayment = times(remainingBase, ratio);
    if (p.amount > roundRial(dueAtPayment)) {
      return invalid([{ field: `payments.${p.order}.amount`, message: `مبلغ پرداخت شمارهٔ ${toFaDigits(p.order + 1)} بیش از ماندهٔ به‌روزِ همان ماه است؛ پرداخت‌ها را بررسی کنید.` }]);
    }
    const nextBase = minus(remainingBase, divide(fraction(p.amount, 1n), ratio));
    remainingBase = compare(nextBase, ZERO) <= 0 ? ZERO : nextBase; // اختلاف گردکردن نهایی تا نیم‌ریال
    paid += p.amount;
    steps.push({
      date: p.date.label, month: p.date.month, index: p.index.label,
      paidRial: p.amount, beforeRial: roundRial(dueAtPayment),
      afterRial: roundRial(times(remainingBase, ratio)),
      remainingPrincipalRial: roundRial(remainingBase),
    });
  }

  const actualEndRatio = divide(endIndex.value, originalIndex);
  if (compare(actualEndRatio, ONE) < 0) indexFell = true;
  const endRatio = compare(actualEndRatio, ONE) < 0 ? ONE : actualEndRatio;
  const dueRial = roundRial(times(remainingBase, endRatio));
  const remainingPrincipalRial = roundRial(remainingBase);
  const totalRial = paid + dueRial;
  const datePrecisionWarning = Boolean(
    (due && ambiguousSameMonth(due, start)) || ambiguousSameMonth(start, end)
    || parsedPayments.some((p, i) => ambiguousSameMonth(start, p.date) || ambiguousSameMonth(p.date, end)
      || parsedPayments.slice(i + 1).some((next) => ambiguousSameMonth(p.date, next.date))),
  );
  return {
    ok: true,
    result: {
      startDate: start.label, startMonth: start.month,
      settlementDate: end.label, settlementMonth: end.month,
      startIndex: startIndex.label, endIndex: endIndex.label, baseYear,
      principalRial: principal, paidRial: paid, dueRial,
      remainingPrincipalRial,
      remainingDamageRial: dueRial - remainingPrincipalRial,
      paidDamageRial: paid - (principal - remainingPrincipalRial),
      totalRial, damageRial: totalRial - principal,
      ratio: displayRatio(endIndex.value, originalIndex), steps, indexFell, datePrecisionWarning,
    },
  };
}
