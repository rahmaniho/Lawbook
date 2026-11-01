'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowRight, FileText } from 'lucide-react';
import { getContract, getTopic, getTopicContractGuide, workedExamplesForContract, getDraftContract, CONTRACT_DISCLAIMER, contractsByTopic } from '@/lib/contracts';
import { ContractLearningPanel } from '@/components/contract-learning-panel';
import { ContractWorkedExamples } from '@/components/contract-worked-examples';
import { SectionHeading } from '@/components/bits';
import { Card } from '@/components/ui/primitives';

export default function ContractViewer() {
  const [completed, setCompleted] = useState(false);
  const params = useParams<{ contractId: string }>();
  const contract = getContract(params?.contractId ?? '');
  if (!contract) {
    return <div className="app-container py-10 text-center text-sm text-muted-foreground">قرارداد پیدا نشد.</div>;
  }
  const topic = getTopic(contract.topic)!;
  const guide = getTopicContractGuide(contract.topic);
  const clauses = completed && contract.example ? contract.example.clauses : contract.clauses;
  return (
    <div className="app-container pb-10">
      <Link href="/contracts" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> آموزش قرارداد نویسی
      </Link>

      <SectionHeading title={contract.title} subtitle={topic.title} />

      <Card className="mt-3 p-4">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <FileText size={14} className="text-primary" />
          <span>طرفین: {contract.parties.join('، ')}</span>
        </div>
        <p className="mt-2 text-[12px] leading-6 text-muted-foreground">{contract.summary}</p>
      </Card>

      {getDraftContract(contract.id) && <Link href={`/contracts/draft/${contract.id}`} className="mt-4 block text-sm text-primary underline">تنظیم بندهای این عنوان در قراردادنویس تخصصی</Link>}
      <ContractLearningPanel topicId={contract.topic} />
      <ContractWorkedExamples examples={workedExamplesForContract(contract.id)} />
      <Card className="mt-4 space-y-2 border-dashed p-4 text-xs leading-7">
        <p>{CONTRACT_DISCLAIMER}</p>
        <Link href={`/contracts/learn#${contract.topic}`} className="text-primary underline">نحوه تنظیم و نکات اختصاصی {topic.title}</Link>
      </Card>
      <div className="my-4 flex flex-wrap gap-2" aria-label="نوع نمونه قرارداد">
        <button aria-pressed={!completed} onClick={() => setCompleted(false)} className={`rounded-xl border px-4 py-2 text-sm ${!completed ? 'bg-primary text-primary-foreground' : ''}`}>الگوی قابل تکمیل</button>
        {contract.example && <button aria-pressed={completed} onClick={() => setCompleted(true)} className={`rounded-xl border px-4 py-2 text-sm ${completed ? 'bg-primary text-primary-foreground' : ''}`}>نمونه تکمیل‌شده فرضی</button>}
      </div>
      {completed && <p role="status" className="text-xs leading-7 text-muted-foreground">{contract.example?.label}؛ همه مشخصات، ارقام و تاریخ‌ها صرفاً برای نمایش روش نگارش هستند. پیوست‌ها و مدارک واقعی باید جداگانه تهیه شوند.</p>}
      <div className="mt-4 space-y-3">
        {clauses.map((cl, i) => (
          <Card key={i} className="p-4">
            <p className="text-[13px] font-semibold text-primary">{cl.title}</p>
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-7 text-foreground">{cl.text}</p>
          </Card>
        ))}
      </div>

      {guide && <Card className="mt-4 p-4 text-xs leading-7">
        <h2 className="font-semibold">نکات تنظیم این نوع قرارداد</h2><p>{guide.text}</p>
        <ul className="mt-2 list-inside list-disc">{guide.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
      </Card>}
      <Card className="mt-4 p-4 text-xs leading-7">
        <h2 className="font-semibold">نمونه‌های دیگر این موضوع</h2>
        {contractsByTopic(contract.topic).filter((item) => item.id !== contract.id).slice(0, 4).map((item) => <Link key={item.id} className="block text-primary underline" href={`/contracts/${item.id}`}>{item.title}</Link>)}
      </Card>
      {contract.notes ? (
        <Card className="mt-4 border-dashed p-4">
          <p className="text-[11.5px] leading-6 text-muted-foreground">یادداشت: {contract.notes}</p>
        </Card>
      ) : null}
    </div>
  );
}
