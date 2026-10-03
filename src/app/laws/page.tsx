'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter, Search } from 'lucide-react';
import { useApp } from '@/lib/store';
import { LawRowCard, SectionHeading } from '@/components/bits';
import { EmptyState, Input, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { normalizeForSearch } from '@/lib/fa';

export default function LawsPage() {
  return (
    <Suspense fallback={<LawsSkeleton />}>
      <LawsInner />
    </Suspense>
  );
}

function LawsSkeleton() {
  return (
    <div className="app-container space-y-3 py-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function LawsInner() {
  const catalog = useApp((s) => s.catalog);
  const params = useSearchParams();
  const initialCategory = params.get('category');
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [query, setQuery] = useState('');

  const laws = useMemo(() => {
    if (!catalog) return [];
    const q = normalizeForSearch(query);
    return catalog.laws
      .filter((l) => (category ? l.category === category : true))
      .filter((l) => (q ? normalizeForSearch(`${l.title} ${l.shortTitle} ${l.keywords.join(' ')}`).includes(q) : true))
      .sort((a, b) => (b.approvalSort ?? 0) - (a.approvalSort ?? 0));
  }, [catalog, category, query]);

  if (!catalog) {
    return (
      <div className="app-container space-y-3 py-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="app-container pb-8">
      <div className="sticky top-[52px] z-20 -mx-4 bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-background px-3 py-2">
            <Search size={16} className="text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="نام قانون…"
              className="h-6 border-0 p-0 text-sm focus-visible:ring-0"
            />
          </div>
          <span className="flex items-center gap-1 rounded-2xl border px-3 py-2 text-[11px] text-muted-foreground">
            <Filter size={14} /> {laws.length}
          </span>
        </div>

        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          <Chip active={!category} onClick={() => setCategory(null)}>
            همه
          </Chip>
          {catalog.categories.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.title}
            </Chip>
          ))}
        </div>
      </div>

      {laws.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="قانونی یافت نشد" description="عبارت دیگری را امتحان کنید." />
      ) : (
        <>
          <SectionHeading title={`${laws.length} سند حقوقی`} subtitle={category ? undefined : 'مرتب‌شده بر اساس تاریخ تصویب'} />
          <div className="space-y-2">
            {laws.map((law) => (
              <LawRowCard key={law.id} law={law} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
        active ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}
