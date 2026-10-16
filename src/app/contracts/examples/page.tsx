'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { ContractWorkedExamples } from '@/components/contract-worked-examples';
import { ContractLearningPanel } from '@/components/contract-learning-panel';
import { SectionHeading } from '@/components/bits';
import { Card, Input } from '@/components/ui/primitives';
import { CONTRACTS, CONTRACT_TOPICS, WORKED_EXAMPLES, getExampleGoal, getTopicLearning, workedExamplesForTopic } from '@/lib/contracts';
import { normalizeForSearch, toFaDigits } from '@/lib/fa';

export default function ContractExamplesPage() {
  const [topic, setTopic] = useState('civil');
  const [goal, setGoal] = useState('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const categoryExamples = topic === 'all' ? WORKED_EXAMPLES : workedExamplesForTopic(topic);
    const base = goal === 'all' ? categoryExamples : categoryExamples.filter((example) => getExampleGoal(example.contractId)?.id === goal);
    const q = normalizeForSearch(query.trim());
    if (!q) return base;
    return base.filter((example) => {
      const title = CONTRACTS.find((contract) => contract.id === example.contractId)?.title ?? '';
      return normalizeForSearch(`${example.title} ${example.situation} ${title} ${example.facts.join(' ')}`).includes(q);
    });
  }, [topic, goal, query]);
  const activeTopic = CONTRACT_TOPICS.find((item) => item.id === topic);
  const topicGoals = activeTopic ? getTopicLearning(activeTopic.id)?.goals ?? [] : [];
  const chooseTopic = (id: string) => { setTopic(id); setGoal('all'); };
  const minExamples = Math.min(...CONTRACT_TOPICS.map((item) => workedExamplesForTopic(item.id).length));
  const exerciseCount = WORKED_EXAMPLES.filter((example) => example.exercise).length;

  return (
    <div className="app-container pb-10">
      <Link href="/contracts" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> آموزش قرارداد‌نویسی
      </Link>
      <SectionHeading title="تمرین با موقعیت‌های روزمره" subtitle={`${toFaDigits(WORKED_EXAMPLES.length)} مطالعه موردی؛ دست‌کم ${toFaDigits(minExamples)} مثال در هر دسته`} />
      <Card className="mt-3 border-primary/20 bg-primary/5 p-4 text-[11.5px] leading-6">
        موقعیت‌ها واقع‌نما ولی ساختگی‌اند؛ نام‌ها، تاریخ‌ها و مبالغ برای تمرین انتخاب شده‌اند و سند واقعی یا فرم آماده امضا نیستند. ابتدا به پرسش هر موقعیت فکر کنید، سپس پاسخ پیشنهادی، بند نمونه و دلیل نگارش آن را بخوانید. همهٔ {toFaDigits(exerciseCount)} مثال خودآزمایی دارند.
      </Card>
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 space-y-2 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجو در دسته انتخاب‌شده…" className="pr-9" aria-label="جست‌وجوی مثال‌های قرارداد" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="دسته‌بندی مثال‌ها">
          <button type="button" aria-pressed={topic === 'all'} onClick={() => chooseTopic('all')} className={'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] ' + (topic === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}>
            همه ({toFaDigits(WORKED_EXAMPLES.length)})
          </button>
          {CONTRACT_TOPICS.map((item) => (
            <button key={item.id} type="button" aria-pressed={topic === item.id} onClick={() => chooseTopic(item.id)} className={'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] ' + (topic === item.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}>
              {item.title} ({toFaDigits(workedExamplesForTopic(item.id).length)})
            </button>
          ))}
        </div>
        {activeTopic ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="هدف یادگیری">
            <button type="button" aria-pressed={goal === 'all'} onClick={() => setGoal('all')} className={'shrink-0 rounded-lg border px-2.5 py-1 text-[11px] ' + (goal === 'all' ? 'border-primary text-primary' : 'bg-card text-muted-foreground')}>همه هدف‌ها</button>
            {topicGoals.map((item) => (
              <button key={item.id} type="button" aria-pressed={goal === item.id} onClick={() => setGoal(item.id)} className={'shrink-0 rounded-lg border px-2.5 py-1 text-[11px] ' + (goal === item.id ? 'border-primary text-primary' : 'bg-card text-muted-foreground')}>
                {item.title} · {toFaDigits(workedExamplesForTopic(activeTopic.id).filter((example) => getExampleGoal(example.contractId)?.id === item.id).length)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[11.5px] text-muted-foreground" role="status">
        {activeTopic?.title ?? 'همهٔ دسته‌ها'}: {toFaDigits(filtered.length)} مثال{query ? ' مطابق جست‌وجو' : ''}
      </p>
      {activeTopic ? <ContractLearningPanel topicId={activeTopic.id} /> : null}
      {filtered.length > 0 ? (
        <ContractWorkedExamples examples={filtered} />
      ) : (
        <Card className="mt-4 p-6 text-center text-[12px] text-muted-foreground">برای این عبارت مثالی پیدا نشد؛ دسته یا واژه جست‌وجو را تغییر دهید.</Card>
      )}
    </div>
  );
}
