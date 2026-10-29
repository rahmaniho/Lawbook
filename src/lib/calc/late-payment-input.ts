import jalaali from 'jalaali-js';
import { toEnDigits } from '../fa';
import { JALALI_MAX_YEAR, JALALI_MIN_YEAR } from './late-payment';

export const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const;
export const JALALI_WEEKDAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه',
] as const;

/** فقط نمایش ورودی مبلغ را سه‌رقمی می‌کند؛ مبلغ نامعتبر را به عددی متفاوت تبدیل نمی‌کند. */
export function formatMoneyInput(raw: string, previous = ''): string {
  const text = toEnDigits(raw).trim()
    .replace(/[\u00a0\u2007\u2009\u202f]/g, ' ')
    .replace(/\u066b/g, '.');
  const normalized = text.replace(/\u066c/g, ',');
  // مانند parseAmountRial، جداکننده‌های چسبانده‌شده باید سه‌تایی و از یک نوع باشند.
  // اعشار ناتمام (مثل «۱۰۰۰.») برای تایپ ادامه حفظ می‌شود، اما محاسبه نمی‌شود.
  const match = normalized.match(/^(\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+)(\.\d*)?$/);
  if (match) {
    const digits = match[1].replace(/[ ,]/g, '');
    return digits.length > 30 ? normalized
      : digits.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') + (match[2] ?? '');
  }
  // وقتی کاربر یک رقم را به گروه‌بندی خودکار موجود اضافه/حذف می‌کند، وضعیت
  // موقتِ «۱٬۲۳۴۵» پیش از چینش دوباره معتبرِ سه‌تایی نیست؛ فقط در همین حالت
  // جداکننده‌های ساخته‌شدهٔ خودمان را حذف و مجدداً درج می‌کنیم، نه متن pasteشدهٔ معیوب را.
  if (previous.includes('٬') && text.includes('٬')) {
    const compact = text.replace(/٬/g, '');
    if (/^\d+(?:\.\d*)?$/.test(compact) && compact.split('.')[0].length <= 30) {
      const [whole, fraction] = compact.split('.');
      return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') + (fraction === undefined ? '' : `.${fraction}`);
    }
  }
  return normalized;
}

/** هشت رقم پیوسته را هنگام ورود به YYYY/MM/DD تبدیل می‌کند؛ ماهِ بدون روز هم مجاز می‌ماند. */
export function formatJalaliDateInput(raw: string): string {
  const text = toEnDigits(raw).trim().replace(/[\u2010-\u2015\u2212-]/g, '/').replace(/\s*\/\s*/g, '/');
  const compact = /^\d{0,8}$/.test(text)
    ? text
    // اگر پس از «سال/ماه» رقم سوم ماه تایپ شد، آن را آغازِ روز می‌دانیم.
    : /^\d{4}\/\d{3,4}$/.test(text) ? text.replace('/', '') : null;
  if (compact === null) return text; // ورودی دستی یا نامعتبر را بی‌صدا بازتعبیر نمی‌کنیم.
  if (compact.length <= 4) return compact;
  if (compact.length <= 6) return `${compact.slice(0, 4)}/${compact.slice(4)}`;
  return `${compact.slice(0, 4)}/${compact.slice(4, 6)}/${compact.slice(6)}`;
}

/** موقعیت مکان‌نما را بر پایهٔ ارقام (و ممیز مبلغ) پس از درج جداکننده حفظ می‌کند. */
export function caretAfterFormatting(raw: string, formatted: string, position: number, kind: 'money' | 'date'): number {
  if (raw === formatted) return Math.min(position, formatted.length);
  const significant = (char: string) => /[0-9۰-۹٠-٩]/.test(char) || (kind === 'money' && /[.٫]/.test(char));
  const before = [...raw.slice(0, position)].filter(significant).length;
  if (!before) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (significant(formatted[i]) && ++seen === before) return i + 1;
  }
  return formatted.length;
}

/** چینش روزهای ماه شمسی، از شنبه؛ روزهای خارج از ماه به جای تاریخ ساختگی خالی‌اند. */
export function jalaliMonthCells(year: number, month: number): (number | null)[] {
  if (!Number.isInteger(year) || year < JALALI_MIN_YEAR || year > JALALI_MAX_YEAR
    || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const { gy, gm, gd } = jalaali.toGregorian(year, month, 1);
  const offset = (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7;
  const days = jalaali.jalaaliMonthLength(year, month);
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + days ? i - offset + 1 : null);
}

export function shiftJalaliMonth(year: number, month: number, offset: number): { year: number; month: number } | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(offset)
    || year < JALALI_MIN_YEAR || year > JALALI_MAX_YEAR || month < 1 || month > 12) return null;
  const index = year * 12 + month - 1 + offset;
  const nextYear = Math.floor(index / 12);
  if (nextYear < JALALI_MIN_YEAR || nextYear > JALALI_MAX_YEAR) return null;
  return { year: nextYear, month: index % 12 + 1 };
}
