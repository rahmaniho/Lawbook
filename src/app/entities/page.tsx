'use client';

/**
 * فهرست نهادها، سازمان‌ها، نیروهای مسلح، سازمان‌های بین‌المللی،
 * بانک‌ها، دانشگاه‌ها و شرکت‌های دولتی ایران (فهرست مرجع).
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Banknote, Building2, Factory, GraduationCap, HeartHandshake, Landmark,
  Search, ShieldCheck, Globe2, Shield, Building,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { SectionHeading } from '@/components/bits';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { normalizeForSearch, toFaDigits } from '@/lib/fa';
import { formatNumberFa } from '@/lib/format';
import type { EntityGroup } from '@/lib/types';

/** تعداد نمایش در هر بار (برای روان‌ماندن فهرست‌های طولانی) */
const PAGE = 40;

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: string | number }>;

const ICONS: Record<string, IconComponent> = {
  Landmark,
  Building2,
  Building,
  HeartHandshake,
  Shield,
  ShieldCheck,
  Globe2,
  Banknote,
  GraduationCap,
  Factory,
};

function GroupIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Landmark;
  return <Icon size={18} className={className} />;
}

export default function EntitiesPage() {
  return (
    <Suspense fallback={<EntitiesSkeleton />}>
      <EntitiesInner />
    </Suspense>
  );
}

function EntitiesSkeleton() {
  return (
    <div className="app-container space-y-3 py-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function EntitiesInner() {
  const catalog = useApp((s) => s.catalog);
  const params = useSearchParams();
  const initialGroup = params.get('group');
  const [group, setGroup] = useState<string | null>(initialGroup);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const groups = useMemo<EntityGroup[]>(() => catalog?.entityGroups ?? [], [catalog]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // با تغییر گروه یا عبارت، شمار نمایش از نو شروع می‌شود
  useEffect(() => {
    setLimit(PAGE);
  }, [group, query]);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query);
    return flat.filter((e) => {
      if (group && e.group !== group) return false;
      if (!q) return true;
      return normalizeForSearch(`${e.title} ${e.shortTitle} ${e.abbr} ${e.note}`).includes(q);
    });
  }, [flat, group, query]);

  if (!catalog) {
    return <EntitiesSkeleton />;
  }

  if (!groups.length) {
    return (
      <div className="app-container py-10">
        <EmptyState icon={<Landmark size={22} />} title="فهرست نهادها در دسترس نیست" description="داده‌های این بخش هنوز بارگذاری نشده است." />
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
              placeholder="نام وزارتخانه، سازمان، بانک، دانشگاه…"
              className="h-6 border-0 p-0 text-sm focus-visible:ring-0"
              aria-label="جست‌وجو در نهادها"
            />
          </div>
          <span className="flex items-center gap-1 rounded-2xl border px-3 py-2 text-[11px] text-muted-foreground">
            {formatNumberFa(filtered.length)}
          </span>
        </div>

        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          <Chip active={!group} onClick={() => setGroup(null)}>
            همه ({toFaDigits(flat.length)})
          </Chip>
          {groups.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>
              {g.title} ({toFaDigits(g.items.length)})
            </Chip>
          ))}
        </div>
      </div>

      {!group ? (
        <>
          <SectionHeading
            title="گروه‌های نهادی"
            subtitle={`${toFaDigits(flat.length)} نهاد در ${toFaDigits(groups.length)} گروه — برگرفته از فهرست مرجع`}
          />
          <div className="grid grid-cols-2 gap-2.5">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroup(g.id)}
                className="flex flex-col justify-between rounded-2xl border bg-card p-3.5 text-right shadow-card active:scale-[0.98]"
              >
                <span
                  className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${g.color}1a`, color: g.color }}
                >
                  <GroupIcon name={g.icon} />
                </span>
                <span className="text-[13px] font-semibold leading-5">{g.title}</span>
                <span className="mt-1 text-[10.5px] leading-4 text-muted-foreground">
                  {toFaDigits(g.items.length)} نهاد
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <SectionHeading
        title={group ? groups.find((g) => g.id === group)?.title ?? 'نهادها' : 'همه نهادها'}
        subtitle={group ? groups.find((g) => g.id === group)?.description : 'فهرست کامل نهادهای ثبت‌شده'}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="نهادی یافت نشد" description="عبارت دیگری را امتحان کنید." />
      ) : (
        <Card className="divide-y">
          {filtered.slice(0, limit).map((e) => {
            const g = groups.find((x) => x.id === e.group);
            return (
              <div key={e.id} className="flex items-start gap-3 p-3.5">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${g?.color ?? '#475569'}1a`, color: g?.color ?? '#475569' }}
                >
                  <GroupIcon name={g?.icon ?? 'Landmark'} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-6">{e.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    {e.abbr ? <Badge tone="outline">{e.abbr}</Badge> : null}
                    {g ? <span>{g.title}</span> : null}
                    <span>• {e.status}</span>
                    <span>• منبع: {e.source}</span>
                  </div>
                  {e.note ? <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{e.note}</p> : null}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {limit < filtered.length ? (
        <Button variant="outline" className="mt-3 w-full" onClick={() => setLimit((l) => l + PAGE)}>
          نمایش بیشتر ({toFaDigits(Math.min(PAGE, filtered.length - limit))} مورد دیگر)
        </Button>
      ) : null}

      <p className="mt-5 text-center text-[10.5px] leading-5 text-muted-foreground">
        این فهرست صرفاً برای آشنایی و ارجاع سریع است و جایگزین اطلاعیه‌ها و مصوبات رسمی هر نهاد نیست.
      </p>
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
