'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, FileText, Search } from 'lucide-react';
import { CONTRACT_TOPICS, CONTRACTS, WORKED_EXAMPLES, getContractGuide, workedExamplesForContract, workedExamplesForTopic } from '@/lib/contracts';
import { SectionHeading } from '@/components/bits';
import { Card, Input } from '@/components/ui/primitives';
import { normalizeForSearch } from '@/lib/fa';
import { toFaDigits } from '@/lib/fa';

export default function ContractsPage() {
  const [topic, setTopic] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    return CONTRACTS.filter((c) => {
      if (topic !== 'all' && c.topic !== topic) return false;
      if (!q) return true;
      const t = CONTRACT_TOPICS.find((x) => x.id === c.topic);
      const examples = workedExamplesForContract(c.id);
      return normalizeForSearch(`${c.title} ${c.summary} ${t?.title ?? ''} ${getContractGuide(c.id)?.scenario ?? ''} ${examples.map((example) => `${example.title} ${example.situation}`).join(' ')}`).includes(q);
    });
  }, [topic, query]);

  return (
    <div className="app-container pb-10">
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> خانه
      </Link>

      <SectionHeading
        title="آموزش قرارداد نویسی"
        subtitle={`${toFaDigits(CONTRACTS.length)} موضوع و ${toFaDigits(WORKED_EXAMPLES.length)} مطالعه موردی واقع‌نما`}
      />

      <Link href="/contracts/guide" className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
        <BookOpen size={22} className="shrink-0 text-primary" />
        <span className="flex-1">
          <span className="block text-[13px] font-semibold">از کجا شروع کنم؟</span>
          <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">پنج گام تنظیم قرارداد و مثال‌های بازنویسی بندهای مبهم</span>
        </span>
        <ArrowRight size={16} className="rotate-180 text-primary" />
      </Link>
      <Link href="/contracts/examples" className="mt-2 flex items-center justify-between rounded-2xl border p-3 text-[12px] font-semibold text-primary hover:border-primary/40">
        <span>مرور {toFaDigits(WORKED_EXAMPLES.length)} مثال واقع‌نما و پرسش‌های خودآزمایی</span>
        <ArrowRight size={16} className="rotate-180" />
      </Link>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">مطالعه‌های موردی از موقعیت‌های رایج الهام گرفته‌اند، اما اشخاص، مبالغ و تاریخ‌ها ساختگی‌اند؛ فرم آماده امضا یا شرح پرونده واقعی نیستند. مقررات روز و مدارک را بررسی کنید.</p>

      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 space-y-2.5 bg-background/95 px-4 py-2.5 backdrop-blur">
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی قرارداد…" className="pr-9" aria-label="جست‌وجوی قرارداد" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setTopic('all')} className={'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all active:scale-95 ' + (topic === 'all' ? 'border-primary bg-primary text-primary-foreground shadow-card' : 'bg-card text-muted-foreground hover:border-primary/40')}>همه</button>
          {CONTRACT_TOPICS.map((t) => (
            <button key={t.id} onClick={() => setTopic(t.id)} aria-pressed={topic === t.id} className={'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all active:scale-95 ' + (topic === t.id ? 'border-primary bg-primary text-primary-foreground shadow-card' : 'bg-card text-muted-foreground hover:border-primary/40')}>{t.title} · {toFaDigits(workedExamplesForTopic(t.id).length)} مثال</button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5">
        {filtered.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground">قراردادی پیدا نشد.</Card>
        ) : (
          filtered.map((c) => {
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
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.title} • {toFaDigits(c.clauses.length)} سرفصل</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">مثال: {getContractGuide(c.id)?.scenario}</p>
                      {workedExamplesForContract(c.id).length > 0 ? (
                        <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {toFaDigits(workedExamplesForContract(c.id).length)} مطالعه موردی
                        </span>
                      ) : null}
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
