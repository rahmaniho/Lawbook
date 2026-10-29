import test from 'node:test';
import assert from 'node:assert/strict';

import { amountForInput, calculateLatePayment, parseAmountRial, parseIranianDate } from '../src/lib/calc/late-payment';
import {
  caretAfterFormatting, formatJalaliDateInput, formatMoneyInput,
  jalaliMonthCells, shiftJalaliMonth,
} from '../src/lib/calc/late-payment-input';

test('مبلغ اصلی و پرداخت جزئی با هر رقم به‌صورت سه‌تایی دیده می‌شوند و ارزششان عوض نمی‌شود', () => {
  let visible = '';
  const steps = ['1', '12', '123', '1٬234', '12٬345', '123٬456', '1٬234٬567', '12٬345٬678'];
  for (const [i, digit] of [...'12345678'].entries()) {
    visible = formatMoneyInput(visible + digit, visible);
    assert.equal(visible, steps[i], `رقم ${i + 1}`);
    assert.equal(parseAmountRial(visible, 'rial'), BigInt('12345678'.slice(0, i + 1)));
  }
  assert.equal(formatMoneyInput('1٬2345', '1٬234'), '12٬345');
  assert.equal(formatMoneyInput('1٬23', '1٬234'), '123');
  assert.equal(formatMoneyInput('1٬2349٬567', '1٬234٬567'), '12٬349٬567');
  assert.equal(formatMoneyInput('۱ ۲۳۴ ۵۶۷'), '1٬234٬567');
  assert.equal(formatMoneyInput('١,٢٣٤,٥٦٧'), '1٬234٬567');
  assert.equal(formatMoneyInput('۱۲۳۴٫۵'), '1٬234.5');
  assert.equal(parseAmountRial(formatMoneyInput('۱۲۳۴٫۵'), 'toman'), 12345n);
  assert.equal(formatMoneyInput(amountForInput(12345n, 'rial')), '12٬345');
  assert.equal(formatMoneyInput(amountForInput(12345n, 'toman')), '1٬234.5');
});

test('مبلغ بدفرمت یا اعشارِ ناتمام به‌جای عدد معتبرِ حدسی ذخیره نمی‌شود', () => {
  for (const raw of ['1,23', '1٬23', '1.2.3', '1e3', '1-2']) {
    const shown = formatMoneyInput(raw);
    assert.equal(parseAmountRial(shown, 'rial'), null, raw);
  }
  assert.equal(formatMoneyInput('1000.'), '1٬000.');
  assert.equal(parseAmountRial(formatMoneyInput('1000.'), 'toman'), null);
});

test('تایپ هشت رقم تاریخ کامل را به صورت سال/ماه/روز و شش رقم را به سال/ماه تبدیل می‌کند', () => {
  let visible = '';
  const steps = ['1', '14', '140', '1405', '1405/0', '1405/01', '1405/01/0', '1405/01/01'];
  for (const [i, digit] of [...'14050101'].entries()) {
    visible = formatJalaliDateInput(visible + digit);
    assert.equal(visible, steps[i]);
  }
  assert.equal(parseIranianDate(visible)?.label, '1405/01/01');
  assert.equal(parseIranianDate(steps[5])?.label, '1405/01');
  assert.equal(formatJalaliDateInput('۱۴۰۵۰۱۰۱'), '1405/01/01');
  assert.equal(formatJalaliDateInput('١٤٠٥-٠١-٠١'), '1405/01/01');
  assert.equal(formatJalaliDateInput('1405/0101'), '1405/01/01');
  assert.equal(formatJalaliDateInput('1405/1/1'), '1405/1/1', 'ورودی دستیِ یک‌رقمی بازتعبیر نمی‌شود');
  assert.equal(parseIranianDate(formatJalaliDateInput('1405/1/1'))?.label, '1405/01/01');
  assert.equal(parseIranianDate(formatJalaliDateInput('1404/12/30')), null, 'روز کبیسهٔ نامعتبر اصلاح حدسی نمی‌شود');
});

test('تاریخ و مبلغِ قالب‌بندی‌شدهٔ فرم مستقیماً در محاسبهٔ اصل و پرداخت جزئی پذیرفته می‌شوند', () => {
  const outcome = calculateLatePayment({
    kind: 'check', unit: 'rial', principal: formatMoneyInput('1000000'),
    dueMonth: '', demandMonth: '', orderedMonth: '',
    checkMonth: formatJalaliDateInput('14050101'), settlementMonth: formatJalaliDateInput('14050201'),
    baseYear: '1400', startIndex: '100', endIndex: '150',
    payments: [{ month: formatJalaliDateInput('14050201'), amount: formatMoneyInput('250000'), index: '' }],
  });
  assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.errors.join(' | '));
  assert.equal(outcome.result.dueRial, 1_250_000n);
  assert.equal(outcome.result.damageRial, 500_000n);
});

test('مکان‌نما پس از درج جداکننده کنار همان رقم می‌ماند، نه انتهای مبلغ/تاریخ', () => {
  assert.equal(caretAfterFormatting('1234', '1٬234', 4, 'money'), 5);
  assert.equal(caretAfterFormatting('1234', '1٬234', 1, 'money'), 1);
  assert.equal(caretAfterFormatting('1000.5', '1٬000.5', 6, 'money'), 7);
  assert.equal(caretAfterFormatting('۱۲۳۴', '1٬234', 4, 'money'), 5);
  assert.equal(caretAfterFormatting('14050101', '1405/01/01', 6, 'date'), 7);
  assert.equal(caretAfterFormatting('14050101', '1405/01/01', 8, 'date'), 10);
  assert.equal(caretAfterFormatting('1405/01/01', '1405/01/01', 5, 'date'), 5);
});

test('تقویم شمسی از شنبه شروع می‌شود، کبیسه و مرز سال را درست نشان می‌دهد', () => {
  const first1405 = jalaliMonthCells(1405, 1);
  assert.equal(first1405[0], 1, 'اول فروردین ۱۴۰۵ شنبه است');
  assert.equal(first1405.filter((d) => d !== null).length, 31);
  const first1403 = jalaliMonthCells(1403, 1);
  assert.deepEqual(first1403.slice(0, 5), [null, null, null, null, 1], 'اول فروردین ۱۴۰۳ چهارشنبه است');
  assert.equal(jalaliMonthCells(1403, 12).filter(Boolean).length, 30);
  assert.equal(jalaliMonthCells(1404, 12).filter(Boolean).length, 29);
  assert.equal(jalaliMonthCells(1404, 12).includes(30), false);
  assert.equal(jalaliMonthCells(1405, 1).length % 7, 0);
  assert.deepEqual(shiftJalaliMonth(1404, 12, 1), { year: 1405, month: 1 });
  assert.deepEqual(shiftJalaliMonth(1405, 1, -1), { year: 1404, month: 12 });
  assert.equal(shiftJalaliMonth(1300, 1, -1), null);
  assert.equal(shiftJalaliMonth(1499, 12, 1), null);
  assert.deepEqual(jalaliMonthCells(1500, 1), []);
});
