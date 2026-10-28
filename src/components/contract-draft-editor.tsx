'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import configJson from '@data/contracts/draft-config.json';
import suggestionJson from '@data/contracts/clause-suggestions.json';
import { getContract } from '@/lib/contracts';
import { BASIC_FIELDS, contextualFieldLabel, draftFields, emptyDraft, hasUnresolvedPrompt, prepareDraft, suggestionReferences, suggestionsForClause } from '@/lib/contract-drafting';
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
  const reviewPoints = config.topicReviews[contract.topic] ?? [];
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
        <SectionHeading title={isWorksheet ? `کاربرگ بررسی ${contract.title}` : `تدوین پیش‌نویس ${contract.title}`} subtitle={isWorksheet ? 'گردآوری و راستی‌آزمایی اطلاعات؛ نه سند رسمی یا آماده امضا' : 'متن تخصصی برای انتخاب و ویرایش؛ نه سند آماده امضا'} />
        <Card className="mt-3 border-amber-500/30 bg-amber-500/5 p-4 text-[12px] leading-7">
          <strong className="block">قلمرو بررسی و الزامات پیش از استفاده</strong>
          <p>{suggestionCatalog.introductions[contract.id]}</p>
          <p className="mt-2">{preview.formalNotice || 'این ابزار اعتبار شروط، هویت و اختیار طرفین را بررسی نمی‌کند؛ متن نهایی را با قانون لازم‌الاجرا و مدارک واقعی نزد متخصص تطبیق دهید.'}</p>
          <p className="mt-2">راهنماها و متن‌های پیشنهادی به‌طور خودکار در برگه درج نمی‌شوند. هر بند را آگاهانه انتخاب، جای‌خالی‌ها را تکمیل و متن را متناسب با پرونده اصلاح کنید؛ پیوند مواد قانونی فقط برای مطالعهٔ موضوع است و همه اجزای بند را مستند نمی‌کند.</p>
          <span className="mt-1 block text-[11px] text-muted-foreground">اطلاعات فرم به سرور فرستاده یا در مرورگر ذخیره نمی‌شوند؛ با خروج یا بارگذاری دوباره از دست می‌روند.</span>
        </Card>

        <SectionHeading title="۱. هویت، سمت و موضوع" subtitle="نام طرفین و موضوع برای چاپ الزامی است؛ اسناد هویت و اختیار باید جداگانه احراز شوند" />
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          {BASIC_FIELDS.map((field) => {
            const label = contextualFieldLabel(contract, field.id, field.label);
            return (
              <label key={field.id} className={'block text-[11.5px] font-medium ' + (['subject', 'attachments'].includes(field.id) ? 'sm:col-span-2' : '')}>
                {label} {field.required ? <span className="text-destructive">*</span> : null}
                {['subject', 'attachments'].includes(field.id)
                  ? <Textarea rows={2} value={draft.basics[field.id] ?? ''} onChange={(event) => change('basics', field.id, event.target.value)} className="mt-1" aria-label={label} />
                  : <Input value={draft.basics[field.id] ?? ''} onChange={(event) => change('basics', field.id, event.target.value)} className="mt-1" aria-label={label} />}
              </label>
            );
          })}
        </Card>

        <SectionHeading title="۲. اوصاف و مستندات اختصاصی" subtitle="داده‌های واردشده، ادعای شماست؛ صحت آنها از اسناد و استعلام‌های لازم احراز می‌شود" />
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          {fieldList.map((field) => (
            <label key={field.id} className="block text-[11.5px] font-medium">
              {field.label}
              <Textarea rows={2} value={draft.details[field.id] ?? ''} onChange={(event) => change('details', field.id, event.target.value)} className="mt-1" aria-label={field.label} />
              <span className="mt-1 block text-[10.5px] leading-5 text-muted-foreground">{field.hint}</span>
            </label>
          ))}
        </Card>

        <SectionHeading title="۳. تدوین و راستی‌آزمایی بندها" subtitle="برای همه سرفصل‌ها متن اختصاصی در دسترس است؛ فقط بندی که شما انتخاب یا نوشته‌اید چاپ می‌شود" />
        <div className="space-y-2.5">
          {contract.clauses.map((clause, index) => {
            const suggestions = suggestionsForClause(suggestionCatalog, contract.id, index);
            return (
              <Card key={index} className="p-4">
                <label htmlFor={`clause-${index}`} className="text-[12.5px] font-semibold text-primary">{clause.title}</label>
                {suggestions.length > 0 ? (
                  <details className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11.5px] leading-6">
                    <summary className="flex cursor-pointer items-center gap-2 font-semibold text-primary"><BookOpen size={15} /> {isWorksheet ? 'متن تخصصی برای بررسی در کاربرگ' : 'متن پیشنهادی تخصصی و محور کنترل'}</summary>
                    <p className="mt-2 text-[11px] text-muted-foreground">این متن فقط پیش‌نویس پیشنهادی است؛ تا زمان انتخاب شما چاپ نمی‌شود. جای‌خالی‌ها، آثار قانونی هر شرط و مدارک واقعی را بررسی کنید.</p>
                    {suggestions.map((suggestion, suggestionIndex) => {
                      const references = suggestionReferences(suggestionCatalog, suggestion);
                      return (
                        <div key={suggestionIndex} className="mt-2 rounded-lg border bg-card p-3">
                          <p className="whitespace-pre-wrap break-words leading-7">{suggestion.text}</p>
                          <p className="mt-2 border-t pt-2 text-[10.5px] leading-6 text-muted-foreground"><strong>محور کنترل:</strong> {suggestion.reason}</p>
                          {references.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {references.map((reference) => (
                                <Link key={reference.id} href={`/article/${reference.id}`} target="_blank" rel="noopener noreferrer" className="text-[10.5px] font-medium text-primary underline underline-offset-2" aria-label={`مطالعه ماده ${toFaDigits(reference.number)} ${reference.lawTitle} در زبانه جدید`}>
                                  ماده {toFaDigits(reference.number)} {reference.lawTitle} ↗
                                </Link>
                              ))}
                            </div>
                          ) : <p className="mt-2 text-[10.5px] leading-5 text-muted-foreground">برای این بند ماده‌ای به‌عنوان ارجاع اختصاصی معرفی نشده است؛ مبنای قانونی را در پرونده خود بررسی کنید.</p>}
                          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => insertSuggestion(index, suggestion.text)} disabled={draft.clauses[String(index)] === suggestion.text}>
                            {draft.clauses[String(index)] === suggestion.text ? 'درج شد؛ جای‌خالی‌ها را تکمیل کنید' : 'انتخاب، درج و ویرایش این بند'}
                          </Button>
                        </div>
                      );
                    })}
                  </details>
                ) : null}
                <Textarea id={`clause-${index}`} rows={6} value={draft.clauses[String(index)] ?? ''} onChange={(event) => change('clauses', String(index), event.target.value)} className="mt-2 leading-7" placeholder={isWorksheet ? 'اطلاعات و مدارک واقعی را برای بررسی حقوقی ثبت کنید…' : 'متن دقیق بند، مبلغ، سررسید، مرجع و پیوست واقعی را بنویسید…'} />
                {hasUnresolvedPrompt(draft.clauses[String(index)] ?? '') ? <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300" role="status">جای‌خالی‌های این بند باید تکمیل شوند؛ چاپ تا آن زمان غیرفعال است.</p> : null}
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
              <Textarea rows={5} value={item.text} onChange={(event) => changeAdded(item.id, 'text', event.target.value)} className="mt-2 leading-7" placeholder="متن دقیق و قابل راستی‌آزمایی بند جدید" aria-label={`متن بند افزوده ${toFaDigits(index + 1)}`} />
            </Card>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => { const id = `extra-${++serial.current}`; setDraft((current) => ({ ...current, additions: [...current.additions, { id, title: '', text: '' }] })); }}><Plus size={15} /> افزودن بند دلخواه</Button>
        </div>

        <SectionHeading title="۴. کنترل نهایی و پیش‌نمایش چاپ" subtitle="امکان چاپ، به معنای صحت حقوقی یا کامل‌بودن بندهای لازم نیست" />
        {reviewPoints.length > 0 ? (
          <Card className="p-4 text-[11.5px] leading-7">
            <strong>چک‌لیست تطبیق ماهوی این حوزه:</strong>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">{reviewPoints.map((point) => <li key={point}>{point}</li>)}</ul>
          </Card>
        ) : null}
        {preview.issues.length > 0 ? (
          <Card className="mt-3 border-amber-500/30 p-4 text-[11.5px] leading-6" role="status">
            <strong>برای فعال‌شدن چاپ:</strong>
            <ul className="mt-1 list-inside list-disc">{preview.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </Card>
        ) : null}
        <p className="mt-3 text-[11px] leading-6 text-muted-foreground">{toFaDigits(contract.clauses.length - preview.missingClauses.length)} بند از {toFaDigits(contract.clauses.length)} سرفصل این عنوان متن دارد. هر سرفصل خالی از چاپ حذف می‌شود؛ حذف آن ممکن است تعهدات لازم برای پرونده شما را ناگفته بگذارد.</p>
        {preview.missingClauses.length > 0 ? <p className="mt-1 text-[11px] leading-6 text-amber-700 dark:text-amber-300">{toFaDigits(preview.missingClauses.length)} سرفصل تعیین تکلیف نشده است و فهرست آن در برگه چاپی می‌آید. پیش از هر استفاده واقعی، درباره ضرورت یا عدم شمول هر کدام تصمیم بگیرید.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={!preview.printable} onClick={() => window.print()}><Printer size={16} /> چاپ / ذخیره PDF</Button>
          <Button type="button" variant="outline" onClick={() => { if (window.confirm('همه اطلاعات واردشده در این صفحه پاک شود؟')) setDraft(emptyDraft()); }}><RotateCcw size={15} /> پاک‌کردن فرم</Button>
        </div>
      </div>

      <section className="contract-print mt-7 rounded-2xl border bg-white p-5 text-slate-900 shadow-card sm:p-7" dir="rtl" aria-label="پیش‌نمایش برگه قابل چاپ">
        <div className="border-b border-slate-300 pb-4">
          <p className="text-[11px] font-semibold text-slate-600">{isWorksheet ? 'کاربرگ بررسی اطلاعات ـ سند رسمی نیست' : 'پیش‌نویس برای بررسی ـ آماده امضا نیست'}{!preview.printable ? ' ـ اطلاعات ضروری ناقص است' : preview.missingClauses.length > 0 ? ' ـ سرفصل‌های تکمیل‌نشده دارد' : ''}</p>
          <h1 className="mt-2 text-xl font-bold">{isWorksheet ? 'موضوع کاربرگ: ' : 'موضوع پیش‌نویس: '}{contract.title}</h1>
          <p className="mt-2 text-[11px] leading-6 text-slate-600">این برگه فقط از اطلاعات و بندهایی تشکیل شده که کاربر وارد یا آگاهانه انتخاب کرده است. هویت، اختیار امضا، اصالت مدارک، اعتبار شروط، قانون روز و تشریفات بررسی نشده‌اند. {preview.formalNotice}</p>
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
          <p className="print-section mt-5 border-t border-slate-300 pt-3 text-[11px] leading-6">سرفصل‌های تعیین تکلیف نشده و درج‌نشده در این نسخه: {preview.missingClauses.join('، ')}. پیش از هر استفاده واقعی، شمول یا عدم شمول هر کدام و آثار حذف آن‌ها باید بررسی شود.</p>
        ) : null}
        <p className="mt-6 border-t border-slate-300 pt-3 text-[10px] leading-5 text-slate-600">این خروجی برای بررسی است، نه سند آمادهٔ امضا یا مشاورهٔ حقوقی. پیش از استفاده واقعی، اصالت اسناد و سمت اشخاص، متن کامل بندها، قوانین آمره و تشریفات لازم را با نظر متخصص بررسی کنید؛ در موارد ثبتی و خانوادگی کاربرگ جای سند و تصمیم مرجع صالح را نمی‌گیرد.</p>
      </section>
    </div>
  );
}
