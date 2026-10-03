'use client';

import Link from 'next/link';
import { BookMarked, Calculator, ChevronLeft, FileCheck2, Landmark, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { CategoryGrid, LawRowCard, SectionHeading, StatsStrip } from '@/components/bits';
import { Card, Skeleton } from '@/components/ui/primitives';
import { AppLogo } from '@/components/app-shell';
import { toFaDigits } from '@/lib/fa';
import { formatIsoToJalali } from '@/lib/format';

export default function HomePage() {
  const catalog = useApp((s) => s.catalog);
  const progress = useApp((s) => s.progress);

  if (!catalog) {
    return (
      <div className="app-container space-y-4 py-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const featured = [...catalog.laws]
    .sort((a, b) => (b.approvalSort ?? 0) - (a.approvalSort ?? 0))
    .slice(0, 4);

  const popular = ['civil-code', 'islamic-penal-code', 'labor-code', 'family-protection-law']
    .map((id) => catalog.laws.find((l) => l.id === id))
    .filter(Boolean) as typeof catalog.laws;

  return (
    <div className="app-container pb-6">
      {/* کارت اعتبار حقوقی و توسعه‌دهنده */}
      <Card className="mt-3 overflow-hidden">
        <div className="bg-gradient-to-l from-primary/12 via-primary/5 to-transparent p-4">
          <div className="flex items-start gap-3">
            <AppLogo />
            <div className="min-w-0">
              <h1 className="text-base font-bold">{catalog.appName}</h1>
              <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                جمع‌آوری و تدوین: وکیل پایه یک دادگستری لیلا آبکه
              </p>
              <p className="text-[11.5px] leading-5 text-muted-foreground">
                توسعه نرم‌افزار:{' '}
                <a className="font-medium text-primary" href="https://karen-soft.ir" target="_blank" rel="noreferrer">
                  کارن سافت
                </a>
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Sparkles size={13} className="text-primary" />
            <span>
              نسخه داده {toFaDigits(catalog.version.split('+')[0])} • به‌روزرسانی {formatIsoToJalali(catalog.releasedAt)}
            </span>
          </div>
        </div>
      </Card>

      <SectionHeading title="نگاه کلی" />
      <StatsStrip stats={catalog.stats} />

      <SectionHeading title="دسته‌های موضوعی" subtitle="برای مرور سریع قوانین، دسته دلخواه را انتخاب کنید" />
      <CategoryGrid categories={catalog.categories} />

      <SectionHeading title="دسترسی سریع" />
      <div className="grid grid-cols-2 gap-2.5">
        <QuickLink href="/calculator/inheritance" icon={<Calculator size={18} />} title="محاسبه‌گر ارث" />
        <QuickLink href="/calculator/diyyeh" icon={<Calculator size={18} />} title="محاسبه‌گر دیه" />
        <QuickLink href="/coverage" icon={<FileCheck2 size={18} />} title="گزارش پوشش قوانین" />
        <QuickLink href="/about" icon={<Landmark size={18} />} title="درباره ما و منابع رسمی" />
      </div>

      <SectionHeading
        title="تازه‌ترین قوانین"
        action={
          <Link href="/laws" className="flex items-center gap-1 text-[11px] font-medium text-primary">
            همه قوانین <ChevronLeft size={13} />
          </Link>
        }
      />
      <div className="space-y-2">
        {featured.map((law) => (
          <LawRowCard key={law.id} law={law} />
        ))}
      </div>

      <SectionHeading title="پرخواننده‌ترین‌ها" />
      <div className="space-y-2">
        {popular.map((law) => (
          <LawRowCard key={law.id} law={law} />
        ))}
      </div>

      <SectionHeading title="میان‌برهای مفید" />
      <Card className="divide-y">
        <ShortcutRow href="/bookmarks" title="نشان‌شده‌ها و یادداشت‌های من" subtitle="دسترسی سریع به مواد نشان‌گذاری‌شده" />
        <ShortcutRow href="/search?q=%D9%85%D9%87%D8%B1%DB%8C%D9%87" title="جست‌وجوی «مهریه»" subtitle="نمونه جست‌وجو در مواد قانونی" />
        <ShortcutRow href="/laws/constitution" title="قانون اساسی" subtitle="مقدمه و ۱۷۷ اصل" />
      </Card>

      <p className="mt-5 text-center text-[10.5px] leading-5 text-muted-foreground">
        {catalog.disclaimer}
      </p>

      {progress.phase === 'downloading' ? (
        <p className="mt-2 text-center text-[10.5px] text-primary">
          در حال به‌روزرسانی داده‌ها… {progress.lawTitle}
        </p>
      ) : null}
    </div>
  );
}

function QuickLink({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-2xl border bg-card p-3.5 text-[12.5px] font-medium shadow-card active:scale-[0.98]"
    >
      <span className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</span>
      {title}
    </Link>
  );
}

function ShortcutRow({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3.5 active:bg-accent/40">
      <BookMarked size={17} className="text-primary" />
      <span className="flex-1">
        <span className="block text-[12.5px] font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronLeft size={16} className="text-muted-foreground" />
    </Link>
  );
}
