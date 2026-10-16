'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import configJson from '@data/contracts/draft-config.json';
import suggestionJson from '@data/contracts/clause-suggestions.json';
import { getContract, getTopicLearning } from '@/lib/contracts';
import { BASIC_FIELDS, draftFields, emptyDraft, prepareDraft, suggestionReferences, suggestionsForClause } from '@/lib/contract-drafting';
import type { DraftConfig, DraftInput, SuggestionCatalog } from '@/lib/contract-drafting';
import { toFaDigits } from '@/lib/fa';
import { SectionHeading } from '@/components/bits';
import { Button, Card, Input, Textarea } from '@/components/ui/primitives';

const config = configJson as DraftConfig;
const suggestionCatalog = suggestionJson as SuggestionCatalog;

export function ContractDraftEditor({ contractId }: { contractId: string }) {
  const contract = getContract(contractId)!;
  const [draft, setDraft] = useState<DraftInput>(emptyDraft);
  const serial = useRef(0);
  const preview = prepareDraft(config, contract, draft);
  const topicLearning = getTopicLearning(contract.topic);
  const fieldList = draftFields(config, contract);
  const isWorksheet = Boolean(preview.formalNotice);

  function change(group: 'basics' | 'details' | 'clauses', id: string, value: string) {
    setDraft((current) => ({ ...current, [group]: { ...current[group], [id]: value } }));
  }
  function changeAdded(id: string, field: 'title' | 'text', value: string) {
    setDraft((current) => ({ ...current, additions: current.additions.map((item) => item.id === id ? { ...item, [field]: value } : item) }));
  }
  function insertSuggestion(index: number, text: string) {
    if ((draft.clauses[String(index)] ?? '').trim() && !window.confirm('متن فعلی این بند با پیشنهاد جایگزین شود؟')) return;
    change('clauses', String(index), text);
    requestAnimationFrame(() => document.getElementById(`clause-${index}`)?.focus());
  }

  return (
    <div className="contract-draft-page app-container pb-10">
      <div className="no-print">
        <Link href="/contracts/draft" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground"><ArrowRight size={13} /> قرارداد‌نویس</Link>
        <SectionHeading title={`تنظیم ${contract.title}`} subtitle={isWorksheet ? 'کاربرگ جمع‌آوری اطلاعات؛ جای سند رسمی نیست' : 'پیش‌نویس قابل بازبینی و چاپ'} />
        <Card className="mt-3 border-amber-500/30 bg-amber-500/5 p-4 text-[12px] leading-7">
          <strong className="block">پیش از نوشتن و چاپ</strong>
          فقط متن‌هایی که خودتان می‌نویسید یا آگاهانه از پیشنهادها انتخاب و ویرایش می‌کنید به برگه چاپی می‌روند. منابع قانونی برای مطالعه‌اند و تأیید خودکار اعتبار متن نیستند. {preview.formalNotice || 'این ابزار اعتبار حقوقی شروط را بررسی نمی‌کند؛ پیش از امضا با قانون روز و متخصص تطبیق دهید.'}
          <span className="mt-1 block text-[11px] text-muted-foreground">اطلاعات فرم روی سرور فرستاده یا در مرورگر ذخیره نمی‌شوند؛ با بستن یا تازه‌کردن صفحه از دست می‌روند.</span>
        </Card>

        <SectionHeading title="۱. طرفین و موضوع" subtitle="نام طرفین و موضوع برای چاپ الزامی‌اند" />
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          {BASIC_FIELDS.map((field) => (
            <label key={field.id} className={'block text-[11.5px] font-medium ' + (['subject', 'attachments'].includes(field.id) ? 'sm:col-span-2' : '')}>
              {field.label} {field.required ? <span className="text-destructive">*</span> : null}
              <Input value={draft.basics[field.id] ?? ''} onChange={(event) => change('basics', field.id, event.target.value)} className="mt-1" aria-label={field.label} />
            </label>
          ))}
        </Card>

        <SectionHeading title="۲. اطلاعات اختصاصی این نوع قرارداد" subtitle="تنها داده‌های ثبت‌شده در پیش‌نمایش چاپ می‌شوند" />
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          {fieldList.map((field) => (
            <label key={field.id} className="block text-[11.5px] font-medium">
              {field.label}
              <Input value={draft.details[field.id] ?? ''} onChange={(event) => change('details', field.id, event.target.value)} className="mt-1" aria-label={field.label} />
              <span className="mt-1 block text-[10.5px] leading-5 text-muted-foreground">{field.hint}</span>
            </label>
          ))}
        </Card>

        <SectionHeading title="۳. بندهای توافقی" subtitle="پیشنهاد مستند را با متن قانون تطبیق دهید؛ فقط در صورت انتخاب شما وارد بند می‌شود" />
        <div className="space-y-2.5">
          {contract.clauses.map((clause, index) => {
            const suggestions = suggestionsForClause(suggestionCatalog, contract.id, index);
            return (
              <Card key={index} className="p-4">
                <label htmlFor={`clause-${index}`} className="text-[12.5px] font-semibold text-primary">{clause.title}</label>
                <p className="mt-1 text-[11px] leading-6 text-muted-foreground">راهنمای آموزشی (چاپ نمی‌شود): {clause.text}</p>
                {suggestions.length > 0 ? (
                  <details className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11.5px] leading-6">
                    <summary className="flex cursor-pointer items-center gap-2 font-semibold text-primary"><BookOpen size={15} /> {isWorksheet ? 'پیشنهاد متن برای بررسی در کاربرگ' : 'پیشنهاد متن با مواد قانونی مرتبط'}</summary>
                    <p className="mt-2 text-[11px] text-muted-foreground">متن و ماده‌ها را باز کنید و با شرایط واقعی و قانون روز بسنجید؛ این ارجاع‌ها خودکار در چاپ درج نمی‌شوند.</p>
                    {suggestions.map((suggestion, suggestionIndex) => (
                      <div key={suggestionIndex} className="mt-2 rounded-lg border bg-card p-3">
                        <p className="whitespace-pre-wrap break-words leading-7">{suggestion.text}</p>
                        <p className="mt-2 text-[10.5px] leading-5 text-muted-foreground">نکته بررسی: {suggestion.reason}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {suggestionReferences(suggestionCatalog, suggestion).map((reference) => (
                            <Link key={reference.id} href={`/article/${reference.id}`} target="_blank" rel="noopener noreferrer" className="text-[10.5px] font-medium text-primary underline underline-offset-2" aria-label={`مطالعه ماده ${toFaDigits(reference.number)} ${reference.lawTitle} در زبانه جدید`}>
                              ماده {toFaDigits(reference.number)} {reference.lawTitle} ↗
                            </Link>
                          ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => insertSuggestion(index, suggestion.text)} disabled={draft.clauses[String(index)] === suggestion.text}>
                          {draft.clauses[String(index)] === suggestion.text ? 'درج شد؛ جای‌خالی‌ها را تکمیل کنید' : 'درج و ویرایش در این بند'}
                        </Button>
                      </div>
                    ))}
                  </details>
                ) : null}
                <Textarea id={`clause-${index}`} rows={3} value={draft.clauses[String(index)] ?? ''} onChange={(event) => change('clauses', String(index), event.target.value)} className="mt-2" placeholder="متن توافق‌شده را با مبلغ، تاریخ، مرجع یا پیوست واقعی بنویسید…" />
              </Card>
            );
          })}
          {draft.additions.map((item, index) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold">بند افزوده {toFaDigits(index + 1)}</h3>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, additions: current.additions.filter((clause) => clause.id !== item.id) }))} className="inline-flex items-center gap-1 text-[11px] text-destructive" aria-label={`حذف بند افزوده ${toFaDigits(index + 1)}`}><Trash2 size={13} /> حذف</button>
              </div>
              <Input value={item.title} onChange={(event) => changeAdded(item.id, 'title', event.target.value)} className="mt-2" placeholder="عنوان بند جدید" aria-label={`عنوان بند افزوده ${toFaDigits(index + 1)}`} />
              <Textarea value={item.text} onChange={(event) => changeAdded(item.id, 'text', event.target.value)} className="mt-2" placeholder="متن بند جدید" aria-label={`متن بند افزوده ${toFaDigits(index + 1)}`} />
            </Card>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => { const id = `extra-${++serial.current}`; setDraft((current) => ({ ...current, additions: [...current.additions, { id, title: '', text: '' }] })); }}><Plus size={15} /> افزودن بند دلخواه</Button>
        </div>

        <SectionHeading title="۴. بررسی و چاپ" subtitle="خروجی همیشه نیازمند بازبینی حقوقی است" />
        {topicLearning ? (
          <Card className="p-4 text-[11.5px] leading-6">
            <strong>نکات مهم پیش از استفاده:</strong>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">{topicLearning.criticalPoints.map((point) => <li key={point}>{point}</li>)}</ul>
          </Card>
        ) : null}
        {preview.issues.length > 0 ? (
          <Card className="mt-3 border-amber-500/30 p-4 text-[11.5px] leading-6" role="status">
            <strong>برای فعال‌شدن چاپ:</strong>
            <ul className="mt-1 list-inside list-disc">{preview.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </Card>
        ) : null}
        {preview.missingClauses.length > 0 ? <p className="mt-2 text-[11px] leading-6 text-muted-foreground">{toFaDigits(preview.missingClauses.length)} سرفصل هنوز متن ندارد و در چاپ به‌عنوان بند درج نمی‌شود؛ وضعیت ناقص‌بودن آن در برگه چاپی مشخص خواهد بود.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={!preview.printable} onClick={() => window.print()}><Printer size={16} /> چاپ / ذخیره PDF</Button>
          <Button type="button" variant="outline" onClick={() => { if (window.confirm('همه اطلاعات واردشده در این صفحه پاک شود؟')) setDraft(emptyDraft()); }}><RotateCcw size={15} /> پاک‌کردن فرم</Button>
        </div>
      </div>

      <section className="contract-print mt-7 rounded-2xl border bg-white p-5 text-slate-900 shadow-card sm:p-7" dir="rtl" aria-label="پیش‌نمایش برگه قابل چاپ">
        <div className="border-b border-slate-300 pb-4">
          <p className="text-[11px] font-semibold text-slate-600">{isWorksheet ? 'کاربرگ بررسی اطلاعات ـ سند رسمی نیست' : 'پیش‌نویس برای بررسی ـ آماده امضا نیست'}{!preview.printable ? ' ـ اطلاعات ضروری ناقص است' : ''}</p>
          <h1 className="mt-2 text-xl font-bold">{contract.title}</h1>
          <p className="mt-2 text-[11px] leading-6 text-slate-600">این برگه از متن‌های واردشده توسط کاربر تهیه شده است. صحت هویت، اختیار امضا، مدارک، قانون و تشریفات بررسی نشده‌اند. {preview.formalNotice}</p>
        </div>
        {preview.issues.length > 0 ? <p className="print-section mt-4 border border-amber-600 p-2 text-[11px] leading-6">این برگه ناقص است: {preview.issues.join(' ')}</p> : null}
        {preview.basics.length > 0 ? (
          <section className="print-section mt-5"><h2 className="text-[14px] font-bold">اطلاعات پایه</h2>
            <dl className="mt-2 grid gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2">{preview.basics.map((item) => <div key={item.id}><dt className="font-semibold">{item.label}</dt><dd className="whitespace-pre-wrap break-words">{item.text}</dd></div>)}</dl>
          </section>
        ) : null}
        {preview.facts.length > 0 ? (
          <section className="print-section mt-5"><h2 className="text-[14px] font-bold">اطلاعات موضوعی واردشده</h2>
            <dl className="mt-2 grid gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2">{preview.facts.map((item) => <div key={item.id}><dt className="font-semibold">{item.label}</dt><dd className="whitespace-pre-wrap break-words">{item.text}</dd></div>)}</dl>
          </section>
        ) : null}
        {[...preview.clauses, ...preview.additions].map((clause) => (
          <section key={clause.id.startsWith('extra-') ? clause.id : `preset-${clause.id}`} className="print-section mt-5 border-t border-slate-200 pt-3">
            <h2 className="text-[13px] font-bold">{clause.title}</h2>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[12px] leading-7">{clause.text}</p>
          </section>
        ))}
        {preview.missingClauses.length > 0 ? (
          <p className="print-section mt-5 border-t border-slate-300 pt-3 text-[11px] leading-6">سرفصل‌های تکمیل‌نشده و درج‌نشده در این نسخه: {preview.missingClauses.join('، ')}. پیش از هر استفاده باید درباره آن‌ها تصمیم بگیرید.</p>
        ) : null}
        <p className="mt-6 border-t border-slate-300 pt-3 text-[10px] leading-5 text-slate-600">این خروجی به‌تنهایی سند معتبر یا مشاوره حقوقی نیست. برای معامله واقعی، متن و مقررات روز و در موارد مهم نظر متخصص را بررسی کنید.</p>
      </section>
    </div>
  );
}
