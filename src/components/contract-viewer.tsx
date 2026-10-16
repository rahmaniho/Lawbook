'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, FileText } from 'lucide-react';
import { getContract, getTopic } from '@/lib/contracts';
import { SectionHeading } from '@/components/bits';
import { Card } from '@/components/ui/primitives';

export default function ContractViewer() {
  const params = useParams<{ contractId: string }>();
  const contract = getContract(params?.contractId ?? '');
  if (!contract) {
    return <div className="app-container py-10 text-center text-sm text-muted-foreground">قرارداد پیدا نشد.</div>;
  }
  const topic = getTopic(contract.topic)!;
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

      <div className="mt-4 space-y-3">
        {contract.clauses.map((cl, i) => (
          <Card key={i} className="p-4">
            <p className="text-[13px] font-semibold text-primary">{cl.title}</p>
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-7 text-foreground">{cl.text}</p>
          </Card>
        ))}
      </div>

      {contract.notes ? (
        <Card className="mt-4 border-dashed p-4">
          <p className="text-[11.5px] leading-6 text-muted-foreground">یادداشت: {contract.notes}</p>
        </Card>
      ) : null}
    </div>
  );
}
