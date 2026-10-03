'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Info, Scale } from 'lucide-react';
import { Card, Input, Segmented, Switch } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { computeDiyyah, DIYAH_PRESETS, formatTomanUnit } from '@/lib/calc/diyyeh';
import { toFaDigits } from '@/lib/fa';
import { cn } from '@/lib/utils';

export default function DiyyahPage() {
  const [full, setFull] = useState(0);
  const [preset, setPreset] = useState(DIYAH_PRESETS[0]);
  const [victimSex, setVictimSex] = useState<'male' | 'female'>('male');
  const [belowThird, setBelowThird] = useState(false);

  const result = useMemo(
    () => computeDiyyah({ fullDiyyah: full, num: preset.num, den: preset.den, victimSex, injuryBelowThird: belowThird }),
    [full, preset, victimSex, belowThird],
  );

  return (
    <div className="app-container pb-10">
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> خانه
      </Link>
      <SectionHeading
        title="محاسبه‌گر دیه"
        subtitle="بر پایه «دیه کامل» سال جاری که مرجع قضایی اعلام می‌کند"
      />

      <Card className="space-y-4 p-4">
        <label className="block">
          <span className="mb-1.5 block text-[11.5px] text-muted-foreground">
            مبلغ دیه کامل سال جاری (تومان)
          </span>
          <Input
            inputMode="numeric"
            value={full ? String(full) : ''}
            onChange={(e) => setFull(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
            placeholder="مثلاً 1200000000"
          />
          <span className="mt-1 block text-[10.5px] leading-5 text-muted-foreground">
            نرخ دیه هر سال توسط قوه قضائیه اعلام و در روزنامه رسمی منتشر می‌شود؛ همان مبلغ را وارد کنید.
          </span>
        </label>

        <div>
          <p className="mb-2 text-[11.5px] text-muted-foreground">نوع جنایت</p>
          <div className="flex flex-wrap gap-2">
            {DIYAH_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
                  preset.id === p.id ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10.5px] text-muted-foreground">مستند: {preset.basis}</p>
        </div>

        <div>
          <p className="mb-2 text-[11.5px] text-muted-foreground">جنسیت مجنیٌ‌علیه</p>
          <Segmented
            value={victimSex}
            onChange={setVictimSex}
            options={[
              { value: 'male', label: 'مرد' },
              { value: 'female', label: 'زن' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12px]">جنایت کمتر از ثلث دیه کامل است</span>
          <Switch checked={belowThird} onChange={setBelowThird} label="کمتر از ثلث" />
        </div>
      </Card>

      <SectionHeading title="نتیجه" />
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Scale size={20} />
          </span>
          <div>
            <p className="text-lg font-bold text-primary">{full ? formatTomanUnit(result.amount) : '—'}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {preset.label} {result.appliedHalfRule ? '• با اعمال قاعده نصف برای زن' : ''}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3">
          {result.notes.map((n, i) => (
            <p key={i} className="flex gap-2 text-[10.5px] leading-5 text-muted-foreground">
              <Info size={12} className="mt-0.5 shrink-0" /> {n}
            </p>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-amber-500/10 p-2.5 text-[10.5px] leading-5 text-amber-800 dark:text-amber-300">
          تعیین میزان دیه اعضای بدن تابع مقررات تفصیلی «مواد ۵۶۳ به بعد قانون مجازات اسلامی» است؛ برای موارد غیر از دیه
          کامل و کسری‌های ساده، بررسی کارشناسی لازم است.
        </div>

        <Link
          href="/laws/islamic-penal-code"
          className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-input bg-background text-sm font-medium active:scale-[0.98]"
        >
          مشاهده مواد قانون مجازات اسلامی
        </Link>
      </Card>

      <p className="mt-5 text-center text-[10.5px] leading-5 text-muted-foreground">
        ارقام محاسبه‌شده {toFaDigits(0)} ریال اختلاف احتمالی ناشی از گرد کردن است؛ مبلغ نهایی را با مرجع رسمی تطبیق دهید.
      </p>
    </div>
  );
}
