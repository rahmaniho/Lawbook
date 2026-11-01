'use client';

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, CircleHelp, Info, Plus, RotateCcw, Scale, ShieldAlert, Trash2, TriangleAlert } from 'lucide-react';
import { Button, Card, Input, Segmented } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { DateInput, MoneyInput } from './form-fields';
import { formatMoneyInput } from '@/lib/calc/late-payment-input';
import {
  amountForInput, calculateLatePayment, compareIranianDates, formatAmountRial, formatIranianDate, formatIranianMonth,
  MAX_PARTIAL_PAYMENTS, parseAmountRial, parseIranianDate,
  type LatePaymentInput, type PartialPaymentInput, type MoneyUnit,
} from '@/lib/calc/late-payment';
import { toFaDigits } from '@/lib/fa';

type PaymentRow = PartialPaymentInput & { id: number };
type FormState = Omit<LatePaymentInput, 'payments'> & { payments: PaymentRow[] };
const EMPTY: FormState = {
  kind: 'ordinary', unit: 'toman', principal: '', dueMonth: '', demandMonth: '',
  checkMonth: '', orderedMonth: '', settlementMonth: '', baseYear: '',
  startIndex: '', endIndex: '', payments: [],
};

const MODE_HINTS = {
  ordinary: 'برای دینِ وجه رایج، مطالبهٔ مستند، تمکن و امتناع مدیون و تغییر فاحش شاخص باید احراز شود. مبدأ پیش‌فرض: ماه مطالبهٔ مؤثر پس از سررسید.',
  check: 'طبق رأی وحدت رویهٔ ۸۱۲، مبدأ وجه چک ماهِ تاریخ مندرج در چک است، نه تاریخ برگشت یا دادخواست. وضعیت‌های استثنایی را جداگانه بررسی کنید.',
  judgment: 'اگر رأی یا اجراییه مبدأ مشخصی دارد، همان ماه را وارد کنید؛ این ابزار محتوای رأی یا شرایط استحقاق را بررسی نمی‌کند.',
} as const;

export default function LatePaymentPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [attempted, setAttempted] = useState(false);
  const nextId = useRef(0);
  const outcome = useMemo(() => calculateLatePayment(form), [form]);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function switchUnit(unit: MoneyUnit) {
    // با تغییر واحد، مقدارهای معتبر به ریال تبدیل و دوباره نمایش داده می‌شوند.
    setForm((prev) => {
      if (unit === prev.unit) return prev;
      const converted = (raw: string) => {
        if (!raw.trim()) return '';
        const rial = parseAmountRial(raw, prev.unit);
        return rial === null ? raw : formatMoneyInput(amountForInput(rial, unit));
      };
      return {
        ...prev, unit,
        principal: converted(prev.principal),
        payments: prev.payments.map((p) => ({ ...p, amount: converted(p.amount) })),
      };
    });
  }

  function updatePayment(id: number, key: keyof PartialPaymentInput, value: string) {
    setForm((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === id ? { ...p, [key]: value } : p) }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
  }

  const unitName = form.unit === 'toman' ? 'تومان' : 'ریال';
  const dueDate = parseIranianDate(form.dueMonth);
  const demandDate = parseIranianDate(form.demandMonth);
  const startDate = form.kind === 'ordinary'
    ? (dueDate && demandDate && compareIranianDates(demandDate, dueDate) >= 0 ? demandDate : null)
    : parseIranianDate(form.kind === 'check' ? form.checkMonth : form.orderedMonth);
  const endDate = parseIranianDate(form.settlementMonth);
  const fieldErrors = attempted && !outcome.ok ? outcome.fieldErrors : {};
  // پس از نخستین درخواست، هر اصلاح روی ورودی‌ها نتیجه/خطا را از نو محاسبه می‌کند.
  const result = attempted && outcome.ok ? outcome.result : null;

  return (
    <div className="app-container pb-10">
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> خانه
      </Link>

      <section className="editorial-hero relative mt-4 overflow-hidden rounded-[1.75rem] border p-5 shadow-card sm:p-6">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          <Scale size={13} /> ابزار محاسباتی · آفلاین
        </div>
        <h1 className="text-[22px] font-bold leading-9 sm:text-2xl">محاسبه‌گر خسارت تأخیر تأدیه</h1>
        <p className="mt-2 text-[12px] leading-6 text-muted-foreground">
          محاسبهٔ شفاف دینِ وجه رایج با شاخص ماهانهٔ واردشده توسط شما؛ تاریخ کامل شمسی، پرداخت‌های جزئی، واحد ریال/تومان و ریز مراحل را پشتیبانی می‌کند.
        </p>
        <p className="mt-4 rounded-xl border bg-background/75 px-3 py-2.5 text-[11.5px] leading-6">
          <span className="font-semibold text-primary">فرمول رأی ۸۵۰:</span> مبلغ به‌روز = اصل دین × (شاخص ماه پرداخت ÷ شاخص ماه مبدأ)
        </p>
      </section>

      <form onSubmit={submit} noValidate>
        <SectionHeading title="۱. نوع مطالبه و تاریخ‌های شمسی" subtitle="۸ رقم مانند ۱۴۰۵۰۱۰۱ تایپ کنید تا ۱۴۰۵/۰۱/۰۱ درج شود، یا تاریخ را از تقویم شمسی برگزینید؛ ماهِ بدون روز هم پذیرفته است." />
        <Card className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-[11.5px] font-medium">مبنای حقوقی مبدأ</p>
            <Segmented
              value={form.kind}
              onChange={(v) => change('kind', v)}
              size="sm"
              options={[
                { value: 'ordinary', label: 'دین عادی' },
                { value: 'check', label: 'وجه چک' },
                { value: 'judgment', label: 'طبق رأی' },
              ]}
            />
          </div>
          <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">{MODE_HINTS[form.kind]}</p>

          {form.kind === 'ordinary' ? (
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
              <Field label="تاریخ یا ماه سررسید دین" htmlFor="due-month" error={fieldErrors.dueMonth}>
                <DateInput id="due-month" label="تاریخ یا ماه سررسید دین" value={form.dueMonth} error={fieldErrors.dueMonth} onChange={(v) => change('dueMonth', v)} />
              </Field>
              <Field label="تاریخ یا ماه مطالبهٔ مستند" htmlFor="demand-month" error={fieldErrors.demandMonth}>
                <DateInput id="demand-month" label="تاریخ یا ماه مطالبهٔ مستند" value={form.demandMonth} error={fieldErrors.demandMonth} onChange={(v) => change('demandMonth', v)} />
              </Field>
            </div>
          ) : form.kind === 'check' ? (
            <Field label="تاریخ مندرج در چک" htmlFor="check-month" error={fieldErrors.checkMonth}>
              <DateInput id="check-month" label="تاریخ مندرج در چک" value={form.checkMonth} error={fieldErrors.checkMonth} onChange={(v) => change('checkMonth', v)} />
            </Field>
          ) : (
            <Field label="مبدأ مقرر در رأی / اجراییه" htmlFor="ordered-month" error={fieldErrors.orderedMonth}>
              <DateInput id="ordered-month" label="مبدأ مقرر در رأی / اجراییه" value={form.orderedMonth} error={fieldErrors.orderedMonth} onChange={(v) => change('orderedMonth', v)} />
            </Field>
          )}

          <Field label="تاریخ پرداخت یا برآورد" htmlFor="settlement-month" error={fieldErrors.settlementMonth}>
            <DateInput id="settlement-month" label="تاریخ پرداخت یا برآورد" value={form.settlementMonth} error={fieldErrors.settlementMonth} onChange={(v) => change('settlementMonth', v)} />
          </Field>
          {startDate ? (
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-[11.5px] leading-6 text-primary">
              مبدأ: <strong>{formatIranianDate(startDate.label)}</strong>؛ ماهِ شاخص مورد نیاز: <strong>{formatIranianMonth(startDate.month)}</strong>
              {form.kind === 'ordinary' ? ' (مطالبهٔ پس از سررسید)' : ''}
            </p>
          ) : null}
          <p className="text-[10.5px] leading-5 text-muted-foreground">
            روزِ دقیق برای کنترل ترتیب سررسید، مطالبه و پرداخت کاربرد دارد، اما شاخص فقط ماهانه است؛ برای بخشی از ماه نرخ روزانه یا سود مرکب ساخته نمی‌شود. اگر روز را ننویسید، ترتیب روزهای همان ماه قابل احراز نیست.
          </p>
        </Card>

        <SectionHeading title="۲. مبلغ و شاخص‌ها" subtitle="شاخص‌ها را از جدول ابلاغی یکسان، با سال پایهٔ مشترک وارد کنید." />
        <Card className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-[11.5px] font-medium">واحد ورودی و نمایش</p>
            <Segmented
              value={form.unit}
              onChange={switchUnit}
              options={[{ value: 'toman', label: 'تومان' }, { value: 'rial', label: 'ریال' }]}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">تعویض واحد، ارزش مبلغ واردشده را حفظ می‌کند.</p>
          </div>
          <Field label={`اصل دین (${unitName})`} htmlFor="principal" error={fieldErrors.principal}>
            <MoneyInput id="principal" value={form.principal} error={fieldErrors.principal}
              onChange={(v) => change('principal', v)} placeholder="۱۰۰٬۰۰۰٬۰۰۰" />
          </Field>
          <p className="text-[10.5px] leading-5 text-muted-foreground">هنگام تایپ، مبلغ به‌طور خودکار سه‌رقمی جدا می‌شود (مثلاً ۱۰۰۰۰۰۰ ← ۱٬۰۰۰٬۰۰۰). ارقام فارسی/انگلیسی و چسباندن مبلغ گروه‌بندی‌شده هم پذیرفته است؛ تومان تا یک رقم اعشار (یک ریال) دارد. واحد را پیش از ورود مبلغ بررسی کنید.</p>
          <div className="border-t pt-4">
            <Field label="سال پایهٔ مشترکِ جدول شاخص‌ها" htmlFor="base-year" error={fieldErrors.baseYear}>
              <Input
                id="base-year" dir="ltr" inputMode="numeric" maxLength={4} autoComplete="off"
                className="text-left tabular-nums" value={form.baseYear}
                aria-invalid={Boolean(fieldErrors.baseYear)} aria-describedby={fieldErrors.baseYear ? 'base-year-error' : undefined}
                onChange={(e) => change('baseYear', e.target.value)} placeholder="مثلاً ۱۴۰۰"
              />
            </Field>
            <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
              عدد شاخص بهای کالاها و خدمات مصرفیِ متناظر با هر ماه را وارد کنید؛ <strong>نه نرخ تورم یا میانگین کل سال</strong>.
              همهٔ اعداد، از جمله شاخص پرداخت‌های جزئی، باید متعلق به یک سری و یک سال پایه باشند.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
            <Field label={`شاخص ماه مبدأ${startDate ? ` (${formatIranianMonth(startDate.month)})` : ''}`} htmlFor="start-index" error={fieldErrors.startIndex}>
              <IndexInput id="start-index" value={form.startIndex} error={fieldErrors.startIndex} onChange={(v) => change('startIndex', v)} />
            </Field>
            <Field label={`شاخص ماه برآورد${endDate ? ` (${formatIranianMonth(endDate.month)})` : ''}`} htmlFor="end-index" error={fieldErrors.endIndex}>
              <IndexInput id="end-index" value={form.endIndex} error={fieldErrors.endIndex} onChange={(v) => change('endIndex', v)} />
            </Field>
          </div>
          <p className="text-[10px] text-muted-foreground">در عدد شاخص، «/» در جدول‌های فارسی به معنی ممیز اعشاری است، نه تقسیم.</p>
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[10.5px] leading-5 text-amber-800 dark:text-amber-300">
            <Info size={13} className="mt-0.5 shrink-0" />
            این برنامه شاخص را حدس نمی‌زند و دادهٔ به‌روزشوندهٔ بانک مرکزی را خودکار دریافت نمی‌کند. اعداد، ماه‌ها و سال پایه را با جدول رسمی پرونده مقابله کنید؛ ورود شاخصِ آینده یا جایگزینی ماهِ منتشرنشده با آخرین ماه، نتیجهٔ قطعیِ پرداخت نیست.
          </p>
        </Card>

        <SectionHeading title="۳. پرداخت‌های جزئیِ مستند" subtitle="اختیاری؛ فقط در فرض تخصیص پرداخت به دین شاخص‌خوردهٔ همان تاریخ از این روش استفاده کنید." />
        <Card className="p-4">
          <p className="text-[11px] leading-5 text-muted-foreground">
            اگر در اجرای حکم بخشی از محکوم‌بهٔ شاخص‌دار پرداخت شده است، هر پرداخت را با شاخص همان ماه ثبت کنید. مانده از سهم تسویه‌نشدهٔ اصل به‌روز می‌شود؛ خسارتِ قبلی دوباره مشمول خسارت نمی‌شود.
          </p>
          <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[10.5px] leading-5 text-amber-800 dark:text-amber-300">
            این روش در فرض پرداخت جزئیِ محکوم‌به در اجرای حکم و بر پایه نظریهٔ مشورتی ۷/۱۴۰۲/۲۲۰ نمایش داده می‌شود. نظریه الزام‌آور نیست؛ پرداخت پیش از حکم، چک یا توافق ویژه دربارهٔ تخصیص وجه ممکن است روش متفاوتی داشته باشد و باید جداگانه بررسی شود.
          </p>
          {form.payments.length > 0 && form.kind !== 'judgment' ? (
            <p className="mt-2 text-[10.5px] leading-5 text-amber-700 dark:text-amber-300">در حالت فعلی، شیوهٔ تخصیص پرداخت‌ها از رأی مشخصی استخراج نشده است. نتیجهٔ پرداخت‌های جزئی فقط تحت فرض فوق برآورد می‌شود؛ آن را خودکار به دین عادی یا چک تعمیم ندهید.</p>
          ) : null}
          {form.payments.length ? (
            <div className="mt-3 space-y-3">
              {form.payments.map((p, i) => {
                const month = parseIranianDate(p.month)?.month;
                const source = month && startDate && month === startDate.month ? 'مبدأ' : month && endDate && month === endDate.month ? 'مقصد' : null;
                return (
                  <div key={p.id} className="rounded-xl border bg-muted/30 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold">پرداخت {toFaDigits(i + 1)}</span>
                      <button
                        type="button" className="inline-flex items-center gap-1 text-[11px] text-destructive"
                        aria-label={`حذف پرداخت ${toFaDigits(i + 1)}`}
                        onClick={() => change('payments', form.payments.filter((row) => row.id !== p.id))}
                      >
                        <Trash2 size={13} /> حذف
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                      <Field label="تاریخ یا ماه پرداخت" htmlFor={`paid-month-${p.id}`} error={fieldErrors[`payments.${i}.month`]}>
                        <DateInput id={`paid-month-${p.id}`} label={`تاریخ یا ماه پرداخت ${toFaDigits(i + 1)}`} value={p.month} error={fieldErrors[`payments.${i}.month`]} onChange={(v) => updatePayment(p.id, 'month', v)} />
                      </Field>
                      <Field label={`مبلغ پرداختی (${unitName})`} htmlFor={`paid-amount-${p.id}`} error={fieldErrors[`payments.${i}.amount`]}>
                        <MoneyInput id={`paid-amount-${p.id}`} value={p.amount} error={fieldErrors[`payments.${i}.amount`]}
                          placeholder="مثلاً ۱۰٬۰۰۰٬۰۰۰" onChange={(v) => updatePayment(p.id, 'amount', v)} />
                      </Field>
                    </div>
                    <div className="mt-2">
                      <Field label="عدد شاخص ماه این پرداخت" htmlFor={`paid-index-${p.id}`} error={fieldErrors[`payments.${i}.index`]}>
                        <IndexInput id={`paid-index-${p.id}`} value={p.index} error={fieldErrors[`payments.${i}.index`]} onChange={(v) => updatePayment(p.id, 'index', v)} />
                      </Field>
                      {source ? <p className="mt-1 text-[10px] leading-5 text-primary">هم‌ماه با {source} است: اگر این فیلد خالی بماند، شاخص همان ماه به‌طور خودکار استفاده می‌شود.</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <Button
            type="button" variant="outline" className="mt-3 w-full gap-2"
            disabled={form.payments.length >= MAX_PARTIAL_PAYMENTS}
            onClick={() => change('payments', [...form.payments, { id: ++nextId.current, month: '', amount: '', index: '' }])}
          >
            <Plus size={15} /> افزودن پرداخت
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">حداکثر {toFaDigits(MAX_PARTIAL_PAYMENTS)} پرداخت؛ همهٔ محاسبات تنها روی همین دستگاه انجام می‌شود.</p>
        </Card>

        <div className="mt-5 flex gap-2">
          <Button type="submit" size="lg" className="min-w-0 flex-1 gap-2 text-[13px]">
            <Calculator size={17} /> محاسبهٔ خسارت
          </Button>
          <Button
            type="button" variant="outline" size="lg" aria-label="پاک کردن فرم" title="پاک کردن فرم"
            onClick={() => { setForm(EMPTY); setAttempted(false); }}
          >
            <RotateCcw size={17} />
          </Button>
        </div>
      </form>

      {attempted && !outcome.ok ? (
        <Card role="alert" className="mt-4 border-destructive/40 bg-destructive/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-destructive">
            <TriangleAlert size={16} /> محاسبه انجام نشد؛ ورودی‌ها را اصلاح کنید.
          </p>
          <ul className="list-inside list-disc space-y-1 text-[11px] leading-5 text-destructive">
            {outcome.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Card>
      ) : null}

      {result ? (
        <section aria-live="polite">
          <SectionHeading title="نتیجه و صورت‌محاسبه" subtitle="خروجی پس از نخستین محاسبه با اصلاح هر ورودی تازه می‌شود؛ مبالغ نمایشی تا نزدیک‌ترین ریال گرد می‌شوند." />
          <Card className="overflow-hidden">
            <div className="bg-primary/10 p-5">
              <span className="text-[11px] text-muted-foreground">ماندهٔ برآوردی در تاریخ/ماه {formatIranianDate(result.settlementDate)}</span>
              <p className="mt-2 break-words text-xl font-bold tabular-nums text-primary" dir="rtl">
                {formatAmountRial(result.dueRial, form.unit)}
              </p>
              <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
                مبلغ فوق از شاخص ماه {formatIranianMonth(result.settlementMonth)} و پرداخت‌های ثبت‌شده محاسبه شده؛ تأیید استحقاق، اصالت شاخص یا مبلغ قطعیِ ماه منتشرنشده نیست.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-0 divide-y px-4 py-1 text-[12px] xs:grid-cols-2 xs:gap-x-4 xs:divide-y-0">
              <ResultRow label="اصل اولیهٔ دین" value={formatAmountRial(result.principalRial, form.unit)} />
              <ResultRow label="پرداخت‌های ثبت‌شده" value={formatAmountRial(result.paidRial, form.unit)} />
              <ResultRow label="اصل باقی‌مانده (معادل ماه مبدأ)" value={formatAmountRial(result.remainingPrincipalRial, form.unit)} />
              <ResultRow label="خسارت شاخصی روی مانده" value={formatAmountRial(result.remainingDamageRial, form.unit)} />
              {result.steps.length ? <ResultRow label="خسارت منتسب به پرداخت‌ها" value={formatAmountRial(result.paidDamageRial, form.unit)} /> : null}
              <ResultRow label="جمع پرداخت‌ها و مانده" value={formatAmountRial(result.totalRial, form.unit)} />
              <ResultRow label="خسارت شاخصی کل" value={formatAmountRial(result.damageRial, form.unit)} emphasis />
            </dl>
            <div className="border-t bg-muted/30 px-4 py-3 text-[10.5px] leading-6 text-muted-foreground">
              <p>مبدأ: {formatIranianDate(result.startDate)}، شاخص ماه {formatIranianMonth(result.startMonth)}: {toFaDigits(result.startIndex.replace('.', '٫'))}</p>
              <p>مقصد: {formatIranianDate(result.settlementDate)}، شاخص ماه {formatIranianMonth(result.settlementMonth)}: {toFaDigits(result.endIndex.replace('.', '٫'))}</p>
              <p>سال پایهٔ اظهارشده: {toFaDigits(result.baseYear)} · نسبت شاخص مقصد به مبدأ ≈ {result.ratio}</p>
              <p>خسارت کل = جمع پرداخت‌ها + ماندهٔ برآوردی − اصل اولیه. تفکیک اصل و خسارت بر پایه ماندهٔ دقیق محاسبه و فقط برای نمایش به ریال گرد شده است.</p>
              {result.datePrecisionWarning ? <p className="mt-1 font-medium text-amber-700 dark:text-amber-400">برای رخدادهای هم‌ماه، روزِ یکی از تاریخ‌ها مشخص نشده است؛ ترتیب واقعی سررسید، مطالبه یا پرداخت را با اسناد بررسی کنید.</p> : null}
              {result.indexFell ? <p className="mt-1 font-medium text-amber-700 dark:text-amber-400">در ماهی شاخص از شاخص مبدأ کمتر بوده؛ برای جلوگیری از کاستنِ اصل دین، ضریب همان مرحله حداقل ۱ لحاظ شده است. پرونده‌های کاهش شاخص را جداگانه بررسی کنید.</p> : null}
            </div>
          </Card>

          {result.steps.length ? (
            <Card className="mt-3 p-4">
              <h2 className="text-[12px] font-semibold">ریز محاسبهٔ پرداخت‌ها</h2>
              <ol className="mt-2 divide-y">
                {result.steps.map((step, i) => (
                  <li key={i} className="py-3 text-[11px] leading-6">
                    <p className="font-semibold">{toFaDigits(i + 1)}. تاریخ/ماه {formatIranianDate(step.date)} · شاخص ماه {toFaDigits(step.index.replace('.', '٫'))}</p>
                    <p className="text-muted-foreground">ماندهٔ به‌روز پیش از پرداخت: {formatAmountRial(step.beforeRial, form.unit)}</p>
                    <p className="text-muted-foreground">پرداخت: {formatAmountRial(step.paidRial, form.unit)} · ماندهٔ پس از پرداخت: {formatAmountRial(step.afterRial, form.unit)}</p>
                    <p className="text-muted-foreground">ماندهٔ مبنایی برای به‌روزرسانی بعدی: {formatAmountRial(step.remainingPrincipalRial, form.unit)}</p>
                  </li>
                ))}
              </ol>
              <p className="text-[10px] leading-5 text-muted-foreground">ماندهٔ دقیقِ هر مرحله بدون گردکردن به مرحلهٔ بعد می‌رود؛ ارقام ریز برای نمایش گرد می‌شوند.</p>
            </Card>
          ) : null}
        </section>
      ) : null}

      <SectionHeading title="مبنای حقوقی و محدودیت‌ها" />
      <Card className="space-y-3 p-4 text-[11px] leading-6">
        <p className="flex items-start gap-2"><ShieldAlert size={15} className="mt-1 shrink-0 text-amber-600" />
          <span>این یک <strong>برآورد ریاضی</strong> است، نه احراز استحقاق. برای دین عادی، احراز مطالبه، تمکن و امتناع مدیون، تغییر فاحش شاخص و نبود مصالحهٔ متفاوت بر عهدهٔ مرجع رسیدگی است. اعسار، تهاتر، تقسیط و شرایط خاص سفته یا مطالبات کارگری می‌توانند نتیجه را تغییر دهند.</span>
        </p>
        <div className="flex items-start gap-2"><CircleHelp size={15} className="mt-1 shrink-0 text-primary" />
          <p>شاخص ماهانهٔ منتشرشده در جدولِ مرجع را برای <strong>هر ماه</strong> وارد کنید؛ «نرخ تورم سالانه»، «متوسط شاخص کل سال» و «نرخ ماهانهٔ رشد» جای عدد شاخص نیستند. اعداد واردشده توسط این برنامه اصالت‌سنجی نمی‌شوند. روز صرفاً ترتیب رویدادها را کنترل می‌کند و شاخص روزانه ساخته نمی‌شود.</p>
        </div>
        <p>در صورت ثبت پرداخت جزئی، تخصیص آن به ماندهٔ شاخص‌خورده فرض شده است؛ روش مورد استفاده در اجرای حکم بر پایه نظریهٔ مشورتی است و به همهٔ چک‌ها، پرداخت‌های پیش از حکم یا توافق‌های اختصاصی تسری قطعی ندارد.</p>
        <p className="rounded-xl bg-muted/60 p-3">
          این فرمول برای مهریهٔ وجه نقد (تبصرهٔ مادهٔ ۱۰۸۲ قانون مدنی و آیین‌نامهٔ خاص آن)، طلب ارزی، وجه التزام قراردادی و سود تسهیلات بانکی طراحی نشده است.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 font-medium text-primary">
          <Link href="/article/civil-procedure-code-522" className="underline underline-offset-4">مادهٔ ۵۲۲ آیین دادرسی مدنی</Link>
          <Link href="/article/supreme-court-precedents-626" className="underline underline-offset-4">رأی وحدت‌رویهٔ ۸۵۰</Link>
          <Link href="/article/supreme-court-precedents-551" className="underline underline-offset-4">رأی وحدت‌رویهٔ ۸۱۲ (چک)</Link>
          <Link href="/article/civil-code-1082" className="underline underline-offset-4">تبصرهٔ مادهٔ ۱۰۸۲ (مهریه)</Link>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, htmlFor, children, error }: { label: string; htmlFor: string; children: ReactNode; error?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[11.5px] text-muted-foreground">{label}</label>
      {children}
      {error ? <p id={`${htmlFor}-error`} className="mt-1 text-[10.5px] leading-5 text-destructive">{error}</p> : null}
    </div>
  );
}

function IndexInput({ id, value, onChange, error }: { id: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Input
      id={id} dir="ltr" inputMode="decimal" autoComplete="off" maxLength={38}
      className="text-left tabular-nums" placeholder="مثلاً ۱۰۰٫۵" value={value}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ResultRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2.5 last:border-0 xs:border-b">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 break-all text-left font-semibold tabular-nums ${emphasis ? 'text-primary' : ''}`}>{value}</dd>
    </div>
  );
}
