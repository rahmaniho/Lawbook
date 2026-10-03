import { Minus, Plus, Type } from 'lucide-react'
import { updateSettings, useSettings } from '../../lib/settings'
import { toFaDigits } from '../../lib/normalize'
import { Segmented } from '../ui/Segmented'
import { Switch } from '../ui/Switch'
import { cn } from '../../lib/utils'

/** تنظیمات حالت مطالعه: فونت، اندازه، فاصله خطوط، تراز، تم */
export function ReaderSettings({ preview = true }: { preview?: boolean }) {
  const s = useSettings()
  const step = (key: 'fontScale' | 'lineHeight', delta: number, min: number, max: number, digits = 0) => {
    const v = Math.round(Math.min(max, Math.max(min, s[key] + delta)) * 10 ** digits) / 10 ** digits
    updateSettings({ [key]: v } as Partial<typeof s>)
  }
  return (
    <div className="space-y-5">
      {preview && (
        <div className={cn('rounded-2xl border border-line bg-surface-2/50 p-4', s.readerTheme === 'sepia' && 'reader-sepia bg-[var(--surface)]')}>
          <p className={cn('law-text', !s.justify && 'align-start')}>
            قراردادهای خصوصی نسبت به کسانی که آن را منعقد نموده‌اند در صورتی که مخالف صریح قانون نباشد نافذ است.
          </p>
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-semibold">قلم متن</p>
        <Segmented
          value={s.readerFont}
          onChange={(v) => updateSettings({ readerFont: v })}
          options={[
            { value: 'vazirmatn', label: 'وزیرمتن' },
            { value: 'naskh', label: 'نسخ (نوتو)' },
          ]}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Type className="h-4 w-4" /> اندازه متن
        </span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="کوچک‌تر" onClick={() => step('fontScale', -1, 14, 28)} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-14 text-center text-sm font-bold">{toFaDigits(s.fontScale)}px</span>
          <button type="button" aria-label="بزرگ‌تر" onClick={() => step('fontScale', 1, 14, 28)} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">فاصله خطوط</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="کمتر" onClick={() => step('lineHeight', -0.1, 1.5, 2.8, 1)} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-14 text-center text-sm font-bold">{toFaDigits(s.lineHeight.toFixed(1))}</span>
          <button type="button" aria-label="بیشتر" onClick={() => step('lineHeight', 0.1, 1.5, 2.8, 1)} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm font-semibold">
        تراز دوطرفه متن
        <Switch checked={s.justify} onChange={(v) => updateSettings({ justify: v })} label="تراز دوطرفه" />
      </label>
      <div>
        <p className="mb-2 text-sm font-semibold">تم صفحه</p>
        <Segmented
          value={s.readerTheme === 'sepia' ? 'sepia' : s.theme}
          onChange={(v) => (v === 'sepia' ? updateSettings({ readerTheme: 'sepia', theme: 'light' }) : updateSettings({ readerTheme: 'auto', theme: v }))}
          options={[
            { value: 'system', label: 'خودکار' },
            { value: 'light', label: 'روشن' },
            { value: 'dark', label: 'تیره' },
            { value: 'sepia', label: 'سپیا' },
          ]}
        />
      </div>
    </div>
  )
}
