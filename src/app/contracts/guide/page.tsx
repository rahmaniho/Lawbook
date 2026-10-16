import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { CONTRACTS, CONTRACT_TOPICS, DRAFTING_COMPARISONS, DRAFTING_STEPS, WORKED_EXAMPLES } from '@/lib/contracts';
import type { ContractTopic, WorkedExample } from '@/lib/contracts';
import { SectionHeading } from '@/components/bits';
import { Card } from '@/components/ui/primitives';
import { toFaDigits } from '@/lib/fa';

export const metadata = { title: 'راهنمای گام‌به‌گام قرارداد‌نویسی' };

export default function ContractGuidePage() {
  const featured = CONTRACT_TOPICS.map((topic) => ({
    topic,
    example: WORKED_EXAMPLES.find((item) => CONTRACTS.find((contract) => contract.id === item.contractId)?.topic === topic.id),
  })).filter((item): item is { topic: ContractTopic; example: WorkedExample } => item.example !== undefined);

  return (
    <div className="app-container pb-10">
      <Link href="/contracts" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> آموزش قرارداد‌نویسی
      </Link>
      <SectionHeading title="از توافق تا متن روشن" subtitle="راهنمای آموزشی و مثال‌های قبل و بعد" />
      <Card className="mt-3 border-primary/20 bg-primary/5 p-4 text-[12px] leading-7">
        <BookOpen size={18} className="mb-2 text-primary" />
        این راهنما برای یادگیری پرسش‌های درست هنگام تنظیم قرارداد است، نه قرارداد آماده امضا. اعتبار هر شرط به نوع رابطه، قوانین آمره، مدارک و شرایط روز بستگی دارد. پیش از امضا، نسخه نهایی را با مقررات جاری و در موارد مهم با متخصص بررسی کنید.
      </Card>

      <h2 className="mt-6 text-[14px] font-bold">پنج گام پیش از امضا</h2>
      <div className="mt-3 space-y-2.5">
        {DRAFTING_STEPS.map((step, i) => (
          <Card key={step.title} className="flex gap-3 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">{toFaDigits(i + 1)}</span>
            <div>
              <h3 className="text-[12.5px] font-semibold">{step.title}</h3>
              <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">{step.detail}</p>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-7 text-[14px] font-bold">مثال‌های بازنویسی بندهای مبهم</h2>
      <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">جمله‌های بهتر هم نمونه آموزشی‌اند و باید با مشخصات واقعی و توافق طرفین تکمیل شوند.</p>
      <div className="mt-3 space-y-3">
        {DRAFTING_COMPARISONS.map((example) => (
          <Card key={example.title} className="p-4">
            <h3 className="text-[12.5px] font-semibold">{example.title}</h3>
            <p className="mt-3 rounded-lg bg-destructive/5 p-3 text-[11.5px] leading-6"><span className="font-semibold text-destructive">مبهم: </span>{example.weak}</p>
            <p className="mt-2 rounded-lg bg-primary/5 p-3 text-[11.5px] leading-6"><span className="font-semibold text-primary">روشن‌تر: </span>{example.better}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-6 text-muted-foreground"><CheckCircle2 size={14} className="mt-1 shrink-0 text-primary" />{example.why}</p>
          </Card>
        ))}
      </div>
      <Link href="/contracts/examples" className="mt-6 block rounded-xl border border-primary/20 bg-primary/5 p-4 text-[12px] font-semibold text-primary hover:bg-primary/10">
        مرور همه {toFaDigits(WORKED_EXAMPLES.length)} مثال و خودآزمایی در ۷ دسته ←
      </Link>
      <h2 className="mt-7 text-[14px] font-bold">از مثال‌های واقع‌نما شروع کنید</h2>
      <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">برای هر دسته یک موقعیت رایج با داده‌های فرضی، بندهای پیشنهادی و نکات بررسی ببینید.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {featured.map(({ topic, example }) => (
          <Link key={topic.id} href={`/contracts/${example.contractId}`} className="rounded-xl border bg-card p-3 transition-colors hover:border-primary/40">
            <span className="block text-[10px] text-muted-foreground">{topic.title}</span>
            <span className="mt-1 block text-[12px] font-semibold text-primary">{example.title}</span>
          </Link>
        ))}
      </div>
      <Link href="/contracts" className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-primary">
        مشاهده همه موضوعات <ArrowRight size={14} className="rotate-180" />
      </Link>
    </div>
  );
}
