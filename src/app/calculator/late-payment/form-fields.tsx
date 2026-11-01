'use client';

import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent, type KeyboardEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import jalaali from 'jalaali-js';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button, Input } from '@/components/ui/primitives';
import { toFaDigits } from '@/lib/fa';
import { JALALI_MAX_YEAR, JALALI_MIN_YEAR, parseIranianDate } from '@/lib/calc/late-payment';
import {
  caretAfterFormatting, formatJalaliDateInput, formatMoneyInput,
  jalaliMonthCells, JALALI_MONTH_NAMES, JALALI_WEEKDAYS, shiftJalaliMonth,
} from '@/lib/calc/late-payment-input';

const digit = /[0-9۰-۹٠-٩]/;
const pad = (n: number) => String(n).padStart(2, '0');

/** گروه‌بندی یا درج «/» را بدون پرش مکان‌نما، حتی هنگام ویرایش وسط متن، انجام می‌دهد. */
function useFormattedField(value: string, onChange: (value: string) => void, kind: 'money' | 'date') {
  const ref = useRef<HTMLInputElement>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  function apply(raw: string, cursor: number, fromPaste = false) {
    const formatted = kind === 'money' ? formatMoneyInput(raw, fromPaste ? '' : value) : formatJalaliDateInput(raw);
    const nextCursor = caretAfterFormatting(raw, formatted, cursor, kind);
    onChange(formatted);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const input = ref.current;
      if (input && document.activeElement === input && input.value === formatted) {
        input.setSelectionRange(nextCursor, nextCursor);
      }
      frame.current = null;
    });
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if ((e.nativeEvent as InputEvent).isComposing) {
      onChange(e.currentTarget.value);
      return;
    }
    const inputType = (e.nativeEvent as InputEvent).inputType;
    apply(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length,
      inputType === 'insertFromPaste' || inputType === 'insertFromDrop');
  }

  function handleCompositionEnd(e: CompositionEvent<HTMLInputElement>) {
    apply(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const start = input.selectionStart;
    if (start === null || start !== input.selectionEnd) return;
    const separator = kind === 'money' ? '٬' : '/';
    // حذف جداکنندهٔ خودکار به‌تنهایی دوباره همان جداکننده را می‌سازد؛ رقم مجاور را حذف کن.
    if (e.key === 'Backspace' && start >= 2 && value[start - 1] === separator && digit.test(value[start - 2])) {
      e.preventDefault();
      apply(value.slice(0, start - 2) + value.slice(start), start - 2);
    } else if (e.key === 'Delete' && value[start] === separator && digit.test(value[start + 1] ?? '')) {
      e.preventDefault();
      const next = kind === 'date'
        ? value.slice(0, start + 1) + value.slice(start + 2)
        : value.slice(0, start) + value.slice(start + 2);
      apply(next, kind === 'date' ? start + 1 : start);
    }
  }

  return { ref, handleChange, handleCompositionEnd, handleKeyDown };
}

export function MoneyInput({
  id, value, onChange, error, placeholder,
}: { id: string; value: string; onChange: (value: string) => void; error?: string; placeholder?: string }) {
  const field = useFormattedField(value, onChange, 'money');
  return (
    <Input
      ref={field.ref} id={id} dir="ltr" inputMode="decimal" autoComplete="off" maxLength={48}
      className="text-left tabular-nums" placeholder={placeholder} value={value}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onChange={field.handleChange} onCompositionEnd={field.handleCompositionEnd} onKeyDown={field.handleKeyDown}
    />
  );
}

export function DateInput({
  id, label, value, onChange, error,
}: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string }) {
  const field = useFormattedField(value, onChange, 'date');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: 1400, month: 1 });
  const selected = parseIranianDate(value);
  const cells = jalaliMonthCells(view.year, view.month);
  const previous = shiftJalaliMonth(view.year, view.month, -1);
  const next = shiftJalaliMonth(view.year, view.month, 1);

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      const current = jalaali.toJalaali(new Date());
      const year = selected ? Number(selected.month.slice(0, 4)) : current.jy;
      const month = selected ? Number(selected.month.slice(5, 7)) : current.jm;
      setView(year >= JALALI_MIN_YEAR && year <= JALALI_MAX_YEAR ? { year, month } : { year: JALALI_MAX_YEAR, month: 12 });
    }
    setOpen(nextOpen);
  }

  function chooseDate(day: number) {
    onChange(`${view.year}/${pad(view.month)}/${pad(day)}`);
    setOpen(false);
  }

  function chooseToday() {
    const today = jalaali.toJalaali(new Date());
    onChange(`${today.jy}/${pad(today.jm)}/${pad(today.jd)}`);
    setOpen(false);
  }

  const today = jalaali.toJalaali(new Date());
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, (i + 1) * 7));

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <div className="flex items-center gap-2">
        <Input
          ref={field.ref} id={id} dir="ltr" inputMode="numeric" autoComplete="off" maxLength={10}
          className="min-w-0 flex-1 text-left tabular-nums" placeholder="۱۴۰۵/۰۱/۰۱" value={value}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          onChange={field.handleChange} onCompositionEnd={field.handleCompositionEnd} onKeyDown={field.handleKeyDown}
        />
        <Dialog.Trigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0"
            aria-label={`انتخاب ${label} از تقویم شمسی`} title="انتخاب از تقویم شمسی">
            <CalendarDays size={19} aria-hidden="true" />
          </Button>
        </Dialog.Trigger>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content dir="rtl" className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-3xl border bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-sheet focus:outline-none sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(26rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-sm font-semibold">انتخاب {label}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[11px] leading-5 text-muted-foreground">
                یک روز را انتخاب کنید، یا اگر روز مشخص نیست فقط ماه را ثبت کنید.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="بستن تقویم">
                <X size={17} aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mb-3 flex items-center gap-1" dir="rtl">
            <Button type="button" variant="outline" size="icon-sm" aria-label="ماه قبل"
              disabled={!previous} onClick={() => previous && setView(previous)}>
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
            <select aria-label="ماه شمسی" value={view.month} onChange={(e) => setView({ ...view, month: Number(e.target.value) })}
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {JALALI_MONTH_NAMES.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
            </select>
            <select aria-label="سال شمسی" value={view.year} onChange={(e) => setView({ ...view, year: Number(e.target.value) })}
              className="h-9 w-[5.5rem] rounded-lg border border-input bg-background px-1 text-center text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {Array.from({ length: JALALI_MAX_YEAR - JALALI_MIN_YEAR + 1 }, (_, i) => (
                <option key={i} value={JALALI_MIN_YEAR + i}>{toFaDigits(JALALI_MIN_YEAR + i)}</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="icon-sm" aria-label="ماه بعد"
              disabled={!next} onClick={() => next && setView(next)}>
              <ChevronLeft size={16} aria-hidden="true" />
            </Button>
          </div>

          <table className="w-full table-fixed border-collapse text-center" aria-label={`تقویم ${JALALI_MONTH_NAMES[view.month - 1]} ${toFaDigits(view.year)}`}>
            <thead>
              <tr>{JALALI_WEEKDAYS.map((day) => (
                <th key={day} scope="col" className="pb-1 text-[10px] font-medium text-muted-foreground">
                  <abbr title={day} className="no-underline">{day.slice(0, 1)}</abbr>
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {weeks.map((week, i) => (
                <tr key={i}>{week.map((day, j) => (
                  <td key={j} className="p-0.5">
                    {day === null ? null : (
                      <button type="button" onClick={() => chooseDate(day)}
                        aria-label={`${toFaDigits(day)} ${JALALI_MONTH_NAMES[view.month - 1]} ${toFaDigits(view.year)}`}
                        aria-pressed={selected?.month === `${view.year}/${pad(view.month)}` && selected.day === day}
                        aria-current={today.jy === view.year && today.jm === view.month && today.jd === day ? 'date' : undefined}
                        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.month === `${view.year}/${pad(view.month)}` && selected.day === day
                          ? 'bg-primary font-bold text-primary-foreground'
                          : 'hover:bg-accent'} ${today.jy === view.year && today.jm === view.month && today.jd === day ? 'ring-1 ring-primary' : ''}`}>
                        {toFaDigits(day)}
                      </button>
                    )}
                  </td>
                ))}</tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={chooseToday}>امروز</Button>
            <Button type="button" size="sm" onClick={() => { onChange(`${view.year}/${pad(view.month)}`); setOpen(false); }}>
              انتخاب ماه بدون روز
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
