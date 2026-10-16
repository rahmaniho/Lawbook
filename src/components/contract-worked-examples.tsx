import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { toFaDigits } from '@/lib/fa';
import type { WorkedExample } from '@/lib/contracts';

const rials = (value: number) => `${toFaDigits(value.toLocaleString('en-US'))} ریال`;

export function ContractWorkedExamples({ examples }: { examples: WorkedExample[] }) {
  if (!examples.length) return null;

  return (
    <section className="mt-6" aria-labelledby="worked-examples-heading">
      <h2 id="worked-examples-heading" className="text-[14px] font-bold">مطالعه‌های موردی واقع‌نما</h2>
      <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">
        موقعیت‌ها، تاریخ‌ها، مبالغ و اشخاص این مثال‌ها فرضی‌اند؛ از پرونده یا قرارداد واقعی نقل نشده‌اند. متن بندها برای یادگیری است، نه کپی و امضا.
      </p>
      <div className="mt-3 space-y-3">
        {examples.map((example, index) => (
          <Card key={example.id} className="overflow-hidden">
            <details open={index === 0} className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <BookOpen size={17} className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold">{example.title}</span>
                  <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{example.situation}</span>
                </span>
                <ChevronDown size={17} className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t px-4 pb-4 pt-3">
                <h3 className="text-[11.5px] font-semibold">داده‌های این موقعیت فرضی</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[11.5px] leading-6 text-muted-foreground">
                  {example.facts.map((fact) => <li key={fact}>{fact}</li>)}
                </ul>

                {example.payments ? (
                  <div className="mt-3 rounded-xl border bg-background p-3 text-[11.5px]" aria-label="جدول مبالغ مثال">
                    <p className="font-semibold">جمع مبالغ: {rials(example.payments.totalRials)}</p>
                    <dl className="mt-2 space-y-1.5 text-muted-foreground">
                      {example.payments.items.map((item) => (
                        <div key={item.label} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                          <dt>{item.label}</dt><dd className="whitespace-nowrap tabular-nums">{rials(item.amountRials)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                <h3 className="mt-4 text-[11.5px] font-semibold">بندهای نمونه و دلیل نگارش</h3>
                <div className="mt-2 space-y-2.5">
                  {example.clauses.map((clause) => (
                    <div key={clause.heading} className="rounded-xl bg-primary/5 p-3">
                      <h4 className="text-[11.5px] font-semibold text-primary">{clause.heading}</h4>
                      <p className="mt-1.5 text-[12px] leading-7">«{clause.wording}»</p>
                      <p className="mt-2 text-[11px] leading-6 text-muted-foreground"><span className="font-semibold">چرا؟ </span>{clause.rationale}</p>
                    </div>
                  ))}
                </div>
                <h3 className="mt-4 text-[11.5px] font-semibold">در استفاده واقعی بررسی کنید</h3>
                <ul className="mt-1 list-inside list-disc space-y-1 text-[11.5px] leading-6 text-muted-foreground">
                  {example.review.map((item) => <li key={item}>{item}</li>)}
                </ul>
                {example.disclaimer ? <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-[11px] leading-6">{example.disclaimer}</p> : null}
                <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">
                  <p className="mb-2">قوانین مرتبط برای مطالعه (نه منبع این داستان فرضی):</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {example.references.map((reference) => (
                      <Link key={reference.lawId} href={`/laws/${reference.lawId}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                        {reference.title}<ArrowRight size={12} className="rotate-180" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </Card>
        ))}
      </div>
    </section>
  );
}
