'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, FileText, Search } from 'lucide-react';
import { CONTRACT_TOPICS, CONTRACTS, WORKED_EXAMPLES, getContractGuide, workedExamplesForContract } from '@/lib/contracts';
import { SectionHeading } from '@/components/bits';
import { Card, Input } from '@/components/ui/primitives';
import { filterContracts } from '@/lib/contract-search';
import { toFaDigits } from '@/lib/fa';

const SEARCH_CONTEXT = Object.fromEntries(CONTRACTS.map((c) => [c.id, [
  getContractGuide(c.id)?.scenario,
  ...workedExamplesForContract(c.id).map((example) => `${example.title} ${example.situation} ${example.facts.join(' ')}`),
].join(' ')]));

export default function ContractsPage() {
  const [topic, setTopic] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');

  const [visible, setVisible] = useState(20);
  const filtered = useMemo(() => filterContracts(CONTRACTS, CONTRACT_TOPICS, topic, query, SEARCH_CONTEXT), [topic, query]);
  function chooseTopic(value: string) { setTopic(value); setVisible(20); }

  return (
    <div className="app-container pb-10">
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> خانه
      </Link>

      <SectionHeading
        title="آموزش قرارداد نویسی"
        subtitle={`${toFaDigits(CONTRACTS.length)} قرارداد در ${toFaDigits(CONTRACT_TOPICS.length)} موضوع`}
      />

      <Card className="my-4 space-y-2 p-4 text-sm">
        <Link href="/contracts/draft" className="block text-primary underline">قراردادنویس تخصصی؛ ویرایش ۳۰ عنوان اصلی</Link>
        <Link href="/contracts/guide" className="block text-primary underline">راهنمای مقایسه بندهای مبهم و روشن</Link>
        <Link href="/contracts/examples" className="block text-primary underline">مرور {toFaDigits(WORKED_EXAMPLES.length)} مطالعه موردی و خودآزمایی</Link>
      </Card>
      <Card className="my-4 space-y-2 p-4">
        <Link href="/contracts/learn" className="font-semibold text-primary underline">آموزش گام‌به‌گام قرارداد‌نویسی و چک‌لیست پیش از امضا</Link>
        <p className="text-xs leading-6 text-muted-foreground">۱۲ درس کاربردی و راهنمای اختصاصی ۱۷ موضوع؛ هر قرارداد دارای الگوی قابل تکمیل و نمونه تکمیل‌شده با اطلاعات فرضی است. نمونه‌ها جای بررسی حقوقی یا سند رسمی لازم را نمی‌گیرند.</p>
      </Card>
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 space-y-2.5 bg-background/95 px-4 py-2.5 backdrop-blur">
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setVisible(20); }} placeholder="جست‌وجو در عنوان و متن مواد…" className="pr-9" aria-label="جست‌وجوی قرارداد" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => chooseTopic('all')} aria-pressed={topic === 'all'} className={'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all active:scale-95 ' + (topic === 'all' ? 'border-primary bg-primary text-primary-foreground shadow-card' : 'bg-card text-muted-foreground hover:border-primary/40')}>همه</button>
          {CONTRACT_TOPICS.map((t) => (
            <button aria-pressed={topic === t.id} key={t.id} onClick={() => chooseTopic(t.id)} className={'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all active:scale-95 ' + (topic === t.id ? 'border-primary bg-primary text-primary-foreground shadow-card' : 'bg-card text-muted-foreground hover:border-primary/40')}>{t.title} ({toFaDigits(CONTRACTS.filter((c) => c.topic === t.id).length)})</button>
          ))}
        </div>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">{toFaDigits(filtered.length)} نتیجه</p>
      <div className="mt-4 grid grid-cols-1 gap-2.5">
        {filtered.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground">قراردادی پیدا نشد.</Card>
        ) : (
          filtered.slice(0, visible).map((c) => {
            const t = CONTRACT_TOPICS.find((x) => x.id === c.topic)!;
            return (
              <Link key={c.id} href={`/contracts/${c.id}`}>
                <Card className="group p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-card" style={{ backgroundColor: t.color }}>
                      <FileText size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{c.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.title} • {toFaDigits(c.clauses.length)} ماده • نمونه تکمیل‌شده</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{c.summary}</p>
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
      {visible < filtered.length && <button onClick={() => setVisible((count) => count + 20)} className="mt-4 w-full rounded-xl border p-3 text-sm text-primary">نمایش ۲۰ نمونه بیشتر</button>}
    </div>
  );
}
