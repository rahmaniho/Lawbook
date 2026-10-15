'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, GraduationCap, Play, RotateCcw, Search } from 'lucide-react';
import { EXAM_CATEGORIES } from '@/lib/exam/categories';
import { EXAMS, bankStats } from '@/lib/exam/exams';
import { loadHistory } from '@/lib/exam/storage';
import type { ExamCategoryId, ExamHistoryEntry } from '@/lib/exam/types';
import { Card, Input } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { normalizeForSearch } from '@/lib/fa';
import { toFaDigits } from '@/lib/fa';

/** فیلتر «همه» کنار ۹ دسته */
const FILTERS: Array<{ id: ExamCategoryId | 'all'; label: string }> = [
  { id: 'all', label: 'همه' },
  ...EXAM_CATEGORIES.map((c) => ({ id: c.id as ExamCategoryId | 'all', label: c.title })),
];

export default function ExamListPage() {
  const [filter, setFilter] = useState<ExamCategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Record<string, ExamHistoryEntry>>({});

  /* تاریخچه در نخستین بارگذاری و با هر بازگشت به صفحه (focus) تازه می‌شود */
  useEffect(() => {
    const refresh = () => setHistory(loadHistory());
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const stats = useMemo(() => bankStats(), []);

  const exams = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    return EXAMS.filter((e) => {
      if (filter !== 'all' && e.category !== filter) return false;
      if (!q) return true;
      const cat = EXAM_CATEGORIES.find((c) => c.id === e.category);
      return normalizeForSearch(`${e.title} ${cat?.title ?? ''}`).includes(q);
    });
  }, [filter, query]);

  const inProgressCount = useMemo(
    () => Object.keys(history).length,
    [history],
  );

  return (
    <div className="app-container pb-10">
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> خانه
      </Link>

      <SectionHeading
        title="آزمون اختبار"
        subtitle={`${toFaDigits(stats.total)} سوال در ${toFaDigits(EXAMS.length)} آزمون — برای تسلط بر مواد`}
      />

      {/* نوار جست‌وجو و فیلتر دسته */}
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 space-y-2.5 bg-background/95 px-4 py-2.5 backdrop-blur">
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی آزمون (مثلاً: حقوق مدنی)…"
            className="pr-9"
            aria-label="جست‌وجوی آزمون"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all active:scale-95 ' +
                (filter === f.id
                  ? 'border-primary bg-primary text-primary-foreground shadow-card'
                  : 'bg-card text-muted-foreground hover:border-primary/40')
              }
              aria-pressed={filter === f.id}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* آمار کوتاه */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat icon={<GraduationCap size={15} />} value={EXAMS.length} label="آزمون" />
        <Stat icon={<ClipboardList size={15} />} value={stats.total} label="سوال" />
        <Stat icon={<RotateCcw size={15} />} value={inProgressCount} label="آزمون انجام‌شده" />
      </div>

      {/* کارت‌های آزمون */}
      <div className="mt-4 grid grid-cols-1 gap-2.5">
        {exams.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground">
            آزمونی با این شرایط پیدا نشد.
          </Card>
        ) : (
          exams.map((exam) => {
            const cat = EXAM_CATEGORIES.find((c) => c.id === exam.category)!;
            const entry = history[exam.id];
            return (
              <Card key={exam.id} className="group p-4 transition-shadow hover:shadow-lg">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[13px] font-bold text-white shadow-card"
                    style={{ backgroundColor: cat.color }}
                  >
                    {toFaDigits(exam.series)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{exam.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-muted px-1.5 py-0.5">{cat.title}</span>
                      <span>{toFaDigits(exam.questionsPerExam)} سوال</span>
                      <span>{toFaDigits(exam.durationMinutes)} دقیقه</span>
                    </p>
                  </div>
                  <Link
                    href={`/exam/${exam.id}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[11.5px] font-medium text-primary-foreground shadow-card transition-transform active:scale-95"
                  >
                    <Play size={13} />
                    {entry ? 'تلاش مجدد' : 'شروع'}
                  </Link>
                </div>
                {entry ? (
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-[11px]">
                    <span className="text-muted-foreground">
                      {toFaDigits(entry.attempts)} تلاش — آخرین نمره {toFaDigits(entry.lastPercent)}٪
                    </span>
                    <span className="font-semibold text-primary">
                      بهترین: {toFaDigits(entry.bestPercent)}٪
                    </span>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2.5">
      <span className="rounded-xl bg-primary/10 p-1.5 text-primary">{icon}</span>
      <div>
        <strong className="block text-sm font-bold">{toFaDigits(value)}</strong>
        <span className="text-[10.5px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
