'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, BookOpen, CheckCircle2, FileText } from 'lucide-react';
import { getContract, getContractGuide, getTopic, workedExamplesForContract } from '@/lib/contracts';
import { ContractWorkedExamples } from '@/components/contract-worked-examples';
import { ContractLearningPanel } from '@/components/contract-learning-panel';
import { SectionHeading } from '@/components/bits';
import { Card } from '@/components/ui/primitives';

export default function ContractViewer() {
  const params = useParams<{ contractId: string }>();
  const contract = getContract(params?.contractId ?? '');
  if (!contract) {
    return <div className="app-container py-10 text-center text-sm text-muted-foreground">قرارداد پیدا نشد.</div>;
  }
  const topic = getTopic(contract.topic)!;
  const guide = getContractGuide(contract.id);
  return (
    <div className="app-container pb-10">
      <Link href="/contracts" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> آموزش قرارداد‌نویسی
      </Link>

      <SectionHeading title={contract.title} subtitle={topic.title} />

      <Card className="mt-3 p-4">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <FileText size={14} className="text-primary" />
          <span>طرفین: {contract.parties.join('، ')}</span>
        </div>
        <p className="mt-2 text-[12px] leading-6 text-muted-foreground">{contract.summary}</p>
      </Card>

      <Card className="mt-3 border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-primary"><BookOpen size={16} /> مثال عملی: {guide.scenario}</p>
        <p className="mt-3 text-[11px] font-medium text-muted-foreground">نمونه عبارت برای یادگیری (نیازمند تکمیل):</p>
        <p className="mt-1 whitespace-pre-line border-r-2 border-primary/40 pr-3 text-[12px] leading-7">«{guide.sample}»</p>
        <p className="mt-3 text-[11.5px] leading-6 text-muted-foreground"><span className="font-semibold text-foreground">نکته بررسی: </span>{guide.lesson}</p>
      </Card>

      <ContractLearningPanel topicId={topic.id} />
      <ContractWorkedExamples examples={workedExamplesForContract(contract.id)} />

      <SectionHeading title="چک‌لیست پیش از تنظیم" subtitle="مواردی که باید در نسخه واقعی مشخص شوند" />
      <Card className="p-4">
        <ul className="space-y-2">
          {guide.checklist.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[11.5px] leading-6">
              <CheckCircle2 size={15} className="mt-1 shrink-0 text-primary" />{item}
            </li>
          ))}
        </ul>
      </Card>

      <SectionHeading title="سرفصل‌های پیشنهادی برای بررسی" subtitle="متن‌های زیر خام‌اند؛ بندهای ناقص را بدون تعیین جزئیات امضا نکنید" />
      <div className="space-y-3">
        {contract.clauses.map((cl, i) => (
          <Card key={i} className="p-4">
            <h3 className="text-[13px] font-semibold text-primary">{cl.title}</h3>
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-7 text-foreground">{cl.text}</p>
          </Card>
        ))}
      </div>

      {contract.notes ? (
        <Card className="mt-4 border-dashed p-4">
          <p className="text-[11.5px] leading-6 text-muted-foreground">یادداشت: {contract.notes}</p>
        </Card>
      ) : null}
      <p className="mt-4 text-[11px] leading-6 text-muted-foreground">این صفحه مشاوره حقوقی یا سند قابل امضا نیست. قانون و تشریفات لازم را متناسب با موضوع و تاریخ معامله بررسی کنید.</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/contracts/guide" className="inline-flex items-center gap-2 text-[12px] font-medium text-primary">مطالعه راهنمای گام‌به‌گام <ArrowRight size={14} className="rotate-180" /></Link>
        <Link href="/contracts/examples" className="inline-flex items-center gap-2 text-[12px] font-medium text-primary">مرور مثال‌های همه دسته‌ها <ArrowRight size={14} className="rotate-180" /></Link>
      </div>
    </div>
  );
}
