'use client';

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, CircleHelp, Info, Plus, RotateCcw, Scale, ShieldAlert, Trash2, TriangleAlert } from 'lucide-react';
import { Button, Card, Input, Segmented } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import {
  amountForInput, calculateLatePayment, formatAmountRial, formatIranianMonth,
  MAX_PARTIAL_PAYMENTS, parseAmountRial, parseIranianMonth,
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
  const [showResult, setShowResult] = useState(false);
  const nextId = useRef(0);
  const outcome = useMemo(() => calculateLatePayment(form), [form]);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setShowResult(false);
  }

  function switchUnit(unit: MoneyUnit) {
    // با تغییر واحد، مقدارهای معتبر به ریال تبدیل و دوباره نمایش داده می‌شوند.
    setForm((prev) => {
      if (unit === prev.unit) return prev;
      const converted = (raw: string) => {
        if (!raw.trim()) return '';
        const rial = parseAmountRial(raw, prev.unit);
        return rial === null ? raw : amountForInput(rial, unit);
      };
      return {
        ...prev, unit,
        principal: converted(prev.principal),
        payments: prev.payments.map((p) => ({ ...p, amount: converted(p.amount) })),
      };
    });
    setShowResult(false);
  }

  function updatePayment(id: number, key: keyof PartialPaymentInput, value: string) {
    setForm((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === id ? { ...p, [key]: value } : p) }));
    setShowResult(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setShowResult(true);
  }

  const unitName = form.unit === 'toman' ? 'تومان' : 'ریال';
  const dueMonth = parseIranianMonth(form.dueMonth);
  const demandMonth = parseIranianMonth(form.demandMonth);
  const startMonth = form.kind === 'ordinary'
    ? (dueMonth && demandMonth && demandMonth >= dueMonth ? demandMonth : null)
    : parseIranianMonth(form.kind === 'check' ? form.checkMonth : form.orderedMonth);
  const result = outcome.ok && showResult ? outcome.result : null;

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
          برآورد مبلغ دینِ وجه رایج با نسبت شاخص‌های بانک مرکزی؛ اصل، خسارت و ماندهٔ پرداختی را جداگانه ببینید.
        </p>
        <p className="mt-4 rounded-xl border bg-background/75 px-3 py-2.5 text-[11.5px] leading-6">
          <span className="font-semibold text-primary">فرمول رأی ۸۵۰:</span> مبلغ به‌روز = اصل دین × (شاخص ماه پرداخت ÷ شاخص ماه مبدأ)
        </p>
      </section>

      <form onSubmit={submit} noValidate>
        <SectionHeading title="۱. نوع مطالبه و تاریخ‌ها" subtitle="ماه‌های تقویم شمسی؛ شاخص به تفکیک ماه اعلام می‌شود، نه روز." />
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
              <Field label="ماه سررسید دین" htmlFor="due-month">
                <MonthInput id="due-month" value={form.dueMonth} onChange={(v) => change('dueMonth', v)} />
              </Field>
              <Field label="ماه مطالبهٔ مستند" htmlFor="demand-month">
                <MonthInput id="demand-month" value={form.demandMonth} onChange={(v) => change('demandMonth', v)} />
              </Field>
            </div>
          ) : form.kind === 'check' ? (
            <Field label="ماه تاریخ مندرج در چک" htmlFor="check-month">
              <MonthInput id="check-month" value={form.checkMonth} onChange={(v) => change('checkMonth', v)} />
            </Field>
          ) : (
            <Field label="ماه مبدأ مقرر در رأی / اجراییه" htmlFor="ordered-month">
              <MonthInput id="ordered-month" value={form.orderedMonth} onChange={(v) => change('orderedMonth', v)} />
            </Field>
          )}

          <Field label="ماه پرداخت یا ماه برآورد" htmlFor="settlement-month">
            <MonthInput id="settlement-month" value={form.settlementMonth} onChange={(v) => change('settlementMonth', v)} />
          </Field>
          {startMonth ? (
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-[11.5px] text-primary">
              ماه مبدأ محاسبه: <strong>{formatIranianMonth(startMonth)}</strong>
              {form.kind === 'ordinary' ? ' (پس از مطالبهٔ مستند)' : ''}
            </p>
          ) : null}
          <p className="text-[10.5px] leading-5 text-muted-foreground">
            روزِ دقیقِ سررسید، مطالبه و پرداخت را با اسناد پرونده تطبیق دهید؛ در این ابزار صرفاً عدد شاخصِ ماه متناظر به کار می‌رود و کسری از ماه محاسبه نمی‌شود.
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
          <Field label={`اصل دین (${unitName})`} htmlFor="principal">
            <Input
              id="principal" dir="ltr" inputMode="decimal" autoComplete="off" maxLength={38}
              className="text-left tabular-nums" value={form.principal}
              onChange={(e) => change('principal', e.target.value)} placeholder="۱۰۰٬۰۰۰٬۰۰۰"
            />
          </Field>
          <div className="border-t pt-4">
            <Field label="سال پایهٔ مشترکِ جدول شاخص‌ها" htmlFor="base-year">
              <Input
                id="base-year" dir="ltr" inputMode="numeric" maxLength={4} autoComplete="off"
                className="text-left tabular-nums" value={form.baseYear}
                onChange={(e) => change('baseYear', e.target.value)} placeholder="مثلاً ۱۳۹۵"
              />
            </Field>
            <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
              عدد شاخص بهای کالاها و خدمات مصرفیِ متناظر با هر ماه را وارد کنید؛ <strong>نه نرخ تورم یا میانگین کل سال</strong>.
              همهٔ اعداد، از جمله شاخص پرداخت‌های جزئی، باید متعلق به یک سری و یک سال پایه باشند.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
            <Field label="عدد شاخص ماه مبدأ" htmlFor="start-index">
              <IndexInput id="start-index" value={form.startIndex} onChange={(v) => change('startIndex', v)} />
            </Field>
            <Field label="عدد شاخص ماه پرداخت / برآورد" htmlFor="end-index">
              <IndexInput id="end-index" value={form.endIndex} onChange={(v) => change('endIndex', v)} />
            </Field>
          </div>
          <p className="text-[10px] text-muted-foreground">در عدد شاخص، «/» در جدول‌های فارسی به معنی ممیز اعشاری است، نه تقسیم.</p>
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[10.5px] leading-5 text-amber-800 dark:text-amber-300">
            <Info size={13} className="mt-0.5 shrink-0" />
            این برنامه شاخص را حدس نمی‌زند و دادهٔ به‌روزشوندهٔ بانک مرکزی را خودکار دریافت نمی‌کند. اعداد، ماه‌ها و سال پایه را با جدول رسمی پرونده مقابله کنید؛ ورود شاخصِ آینده یا جایگزینی ماهِ منتشرنشده با آخرین ماه، نتیجهٔ قطعیِ پرداخت نیست.
          </p>
        </Card>

        <SectionHeading title="۳. پرداخت‌های جزئی" subtitle="اختیاری؛ مبلغ پرداختی در همان ماه از کل دینِ به‌روز کسر می‌شود." />
        <Card className="p-4">
          <p className="text-[11px] leading-5 text-muted-foreground">
            اگر در اجرای حکم بخشی از محکوم‌بهٔ شاخص‌دار پرداخت شده است، هر پرداخت را با شاخص همان ماه ثبت کنید. مانده از سهم تسویه‌نشدهٔ اصل به‌روز می‌شود؛ خسارتِ قبلی دوباره مشمول خسارت نمی‌شود.
          </p>
          <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[10.5px] leading-5 text-amber-800 dark:text-amber-300">
            این روش مبتنی بر نظریهٔ مشورتی ۷/۱۴۰۲/۲۲۰ دربارهٔ پرداخت بخشی از محکوم‌به است. اگر پرداخت پیش از حکم بوده یا دربارهٔ تخصیص وجه توافق ویژه‌ای دارید، نحوهٔ احتساب را از مفاد پرونده و نظر مرجع رسیدگی تعیین کنید.
          </p>
          {form.payments.length ? (
            <div className="mt-3 space-y-3">
              {form.payments.map((p, i) => (
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
                    <Field label="ماه پرداخت" htmlFor={`paid-month-${p.id}`}>
                      <MonthInput id={`paid-month-${p.id}`} value={p.month} onChange={(v) => updatePayment(p.id, 'month', v)} />
                    </Field>
                    <Field label={`مبلغ پرداختی (${unitName})`} htmlFor={`paid-amount-${p.id}`}>
                      <Input
                        id={`paid-amount-${p.id}`} dir="ltr" inputMode="decimal" autoComplete="off"
                        className="text-left tabular-nums" maxLength={38} placeholder="مثلاً ۱۰٬۰۰۰٬۰۰۰"
                        value={p.amount} onChange={(e) => updatePayment(p.id, 'amount', e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="mt-2">
                    <Field label="عدد شاخص همین ماه" htmlFor={`paid-index-${p.id}`}>
                      <IndexInput id={`paid-index-${p.id}`} value={p.index} onChange={(v) => updatePayment(p.id, 'index', v)} />
                    </Field>
                  </div>
                </div>
              ))}
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
            onClick={() => { setForm(EMPTY); setAttempted(false); setShowResult(false); }}
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
          <SectionHeading title="نتیجهٔ محاسبه" subtitle="اعداد نمایش‌داده‌شده در پایان به نزدیک‌ترین ریال گرد شده‌اند." />
          <Card className="overflow-hidden">
            <div className="bg-primary/10 p-5">
              <span className="text-[11px] text-muted-foreground">ماندهٔ قابل پرداخت در ماه {formatIranianMonth(result.settlementMonth)}</span>
              <p className="mt-2 break-words text-xl font-bold tabular-nums text-primary" dir="rtl">
                {formatAmountRial(result.dueRial, form.unit)}
              </p>
              <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
                این رقم، مانده پس از کسر پرداخت‌های ثبت‌شده است؛ حکم قضایی یا مبلغ قطعیِ ماه منتشرنشده نیست.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-0 divide-y px-4 py-1 text-[12px] xs:grid-cols-2 xs:gap-x-4 xs:divide-y-0">
              <ResultRow label="اصل دین" value={formatAmountRial(result.principalRial, form.unit)} />
              <ResultRow label="پرداخت‌های ثبت‌شده" value={formatAmountRial(result.paidRial, form.unit)} />
              <ResultRow label="کل پرداخت‌ها + مانده" value={formatAmountRial(result.totalRial, form.unit)} />
              <ResultRow label="خسارت شاخصی کل" value={formatAmountRial(result.damageRial, form.unit)} emphasis />
            </dl>
            <div className="border-t bg-muted/30 px-4 py-3 text-[10.5px] leading-6 text-muted-foreground">
              <p>مبدأ: {formatIranianMonth(result.startMonth)} (شاخص {toFaDigits(result.startIndex.replace('.', '٫'))}) · مقصد: {formatIranianMonth(result.settlementMonth)} (شاخص {toFaDigits(result.endIndex.replace('.', '٫'))})</p>
              <p>سال پایهٔ واردشده: {toFaDigits(result.baseYear)} · ضریب شاخص مقصد/مبدأ ≈ {result.ratio}</p>
              <p>خسارت شاخصی کل = جمع پرداخت‌ها + ماندهٔ فعلی − اصل دین. به هزینهٔ دادرسی، حق‌الوکاله یا وجه التزام تسری داده نشده است.</p>
              {result.indexFell ? <p className="mt-1 font-medium text-amber-700 dark:text-amber-400">در ماهی شاخص از شاخص مبدأ کمتر بوده؛ برای جلوگیری از کاستنِ اصل دین، ضریب آن مرحله حداقل ۱ لحاظ شده است. پرونده‌های کاهش شاخص را جداگانه بررسی کنید.</p> : null}
            </div>
          </Card>

          {result.steps.length ? (
            <Card className="mt-3 p-4">
              <h2 className="text-[12px] font-semibold">ریز محاسبهٔ پرداخت‌ها</h2>
              <ol className="mt-2 divide-y">
                {result.steps.map((step, i) => (
                  <li key={i} className="py-3 text-[11px] leading-6">
                    <p className="font-semibold">{toFaDigits(i + 1)}. ماه {formatIranianMonth(step.month)} · شاخص {toFaDigits(step.index.replace('.', '٫'))}</p>
                    <p className="text-muted-foreground">دینِ به‌روز قبل از پرداخت: {formatAmountRial(step.beforeRial, form.unit)}</p>
                    <p className="text-muted-foreground">پرداخت: {formatAmountRial(step.paidRial, form.unit)} · ماندهٔ همان ماه: {formatAmountRial(step.afterRial, form.unit)}</p>
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
          <p>شاخص ماهانهٔ منتشرشده در جدولِ مرجع را برای <strong>هر ماه</strong> وارد کنید؛ «نرخ تورم سالانه»، «متوسط شاخص کل سال» و «نرخ ماهانهٔ رشد» جای عدد شاخص نیستند. اعداد واردشده توسط این برنامه اصالت‌سنجی نمی‌شوند.</p>
        </div>
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

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[11.5px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function MonthInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id} dir="ltr" inputMode="text" autoComplete="off" maxLength={10}
      className="text-left tabular-nums" placeholder="۱۴۰۱/۰۴" value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function IndexInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id} dir="ltr" inputMode="decimal" autoComplete="off" maxLength={38}
      className="text-left tabular-nums" placeholder="مثلاً ۱۰۰٫۵" value={value}
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
