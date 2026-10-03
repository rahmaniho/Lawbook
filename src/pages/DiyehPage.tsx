import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Coins, Minus, Plus, Trash2, ExternalLink } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { Disclaimer } from '../components/layout/Disclaimer'
import { Segmented } from '../components/ui/Segmented'
import { Switch } from '../components/ui/Switch'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { calculateDiyeh, DIYEH_ITEMS, DIYEH_RATES, type DiyehGroup, type DiyehSelection } from '../lib/diyeh'
import { toFaDigits, toLatinDigits } from '../lib/normalize'
import { articlePath } from '../lib/utils'

const fmt = (n: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.round(n))
const GROUPS: DiyehGroup[] = ['نفس', 'اعضا', 'منافع', 'جراحات']

export default function DiyehPage() {
  const rate = DIYEH_RATES[0]
  const [baseToman, setBaseToman] = useState(String(rate.fullRial / 10))
  const [victim, setVictim] = useState<'male' | 'female'>('male')
  const [haram, setHaram] = useState(false)
  const [items, setItems] = useState<DiyehSelection[]>([{ id: 'tooth-front', units: 1 }])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [group, setGroup] = useState<DiyehGroup>('اعضا')

  const baseRial = (Number(toLatinDigits(baseToman.replace(/[,٬\s]/g, ''))) || 0) * 10
  const result = useMemo(() => calculateDiyeh({ baseRial, victim, haram, items }), [baseRial, victim, haram, items])
  const hasLife = items.some((i) => i.id === 'life')

  const add = (id: string) => {
    setItems((list) => (list.some((i) => i.id === id) ? list : [...list, { id, units: 1 }]))
    setPickerOpen(false)
  }

  return (
    <div className="pb-2">
      <AppBar back="/tools" title="محاسبه دیه" subtitle={`نرخ رسمی سال ${toFaDigits(rate.year)}`} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <section className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-soft">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">مبلغ دیه کامل (ماه غیرحرام) — تومان</span>
            <input
              inputMode="numeric"
              value={toFaDigits(baseToman)}
              onChange={(e) => setBaseToman(toLatinDigits(e.target.value).replace(/[^\d]/g, ''))}
              className="h-11 w-full rounded-xl border border-line bg-surface-2/50 px-3 text-[15px] outline-none focus:border-brand/60"
            />
            <span className="mt-1.5 block text-[11.5px] leading-5 text-muted">
              {fmt(rate.fullRial / 10)} تومان ({fmt(rate.fullRial)} ریال) — {rate.source}، اعلام: {toFaDigits(rate.announced)}.{' '}
              <a href={rate.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand underline">
                منبع <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </label>
          <div>
            <p className="mb-2 text-sm font-bold">مجنی‌علیه</p>
            <Segmented
              value={victim}
              onChange={setVictim}
              options={[
                { value: 'male', label: 'مرد' },
                { value: 'female', label: 'زن' },
              ]}
            />
          </div>
          {hasLife && (
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-[14.5px] font-medium">وقوع رفتار و فوت در ماه‌های حرام یا حرم مکه</span>
                <span className="block text-[12px] text-muted">محرم، رجب، ذی‌القعده، ذی‌الحجه — ماده ۵۵۵ (فقط قتل)</span>
              </span>
              <Switch checked={haram} onChange={setHaram} label="ماه حرام" />
            </label>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold">صدمات</h2>
            <Button size="sm" variant="soft" onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4" /> افزودن
            </Button>
          </div>
          {!items.length && <p className="py-6 text-center text-sm text-muted">صدمه‌ای انتخاب نشده است.</p>}
          <ul className="space-y-2.5">
            {result.lines.map((l) => (
              <li key={l.item.id} className="rounded-2xl border border-line p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold leading-6">{l.item.title}</p>
                    <p className="text-[12px] text-muted">
                      <span dir="ltr">{toFaDigits(l.fraction.toString())}</span> دیه کامل —{' '}
                      <Link to={articlePath('penal-code', l.item.article)} className="text-brand underline">
                        ماده {toFaDigits(l.item.article)}
                      </Link>
                      {l.halved && <span className="text-accent"> • نصف برای زن</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="حذف"
                    onClick={() => setItems((list) => list.filter((i) => i.id !== l.item.id))}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {l.item.perUnit && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[12.5px] text-muted">تعداد</span>
                    <button
                      type="button"
                      aria-label="کاهش"
                      onClick={() => setItems((list) => list.map((i) => (i.id === l.item.id ? { ...i, units: Math.max(1, i.units - 1) } : i)))}
                      className="grid h-8 w-8 place-items-center rounded-full bg-surface-2"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold">{toFaDigits(l.units)}</span>
                    <button
                      type="button"
                      aria-label="افزایش"
                      onClick={() =>
                        setItems((list) => list.map((i) => (i.id === l.item.id ? { ...i, units: Math.min(l.item.maxUnits ?? 99, i.units + 1) } : i)))
                      }
                      className="grid h-8 w-8 place-items-center rounded-full bg-surface-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-xl bg-surface-2/60 p-2">
                    <p className="text-muted">پرداخت مرتکب/عاقله</p>
                    <p className="font-bold">{fmt(l.offenderRial / 10)} تومان</p>
                  </div>
                  {l.fundRial > 0 ? (
                    <div className="rounded-xl bg-accent-soft/70 p-2">
                      <p className="text-muted">از صندوق خسارت‌های بدنی</p>
                      <p className="font-bold">{fmt(l.fundRial / 10)} تومان</p>
                    </div>
                  ) : l.taghlizRial > 0 ? (
                    <div className="rounded-xl bg-accent-soft/70 p-2">
                      <p className="text-muted">شامل تغلیظ</p>
                      <p className="font-bold">{fmt(l.taghlizRial / 10)} تومان</p>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {result.lines.length > 0 && (
          <section className="rounded-card bg-brand p-4 text-brand-contrast shadow-float">
            <p className="flex items-center gap-2 text-sm opacity-90">
              <Coins className="h-4.5 w-4.5" /> جمع دیه
            </p>
            <p className="mt-1 text-2xl font-black">{fmt(result.totalRial / 10)} تومان</p>
            <p className="text-[12px] opacity-85">{fmt(result.totalRial)} ریال</p>
            {result.fundRial > 0 && (
              <p className="mt-2 text-[12.5px] opacity-95">
                سهم مرتکب/عاقله: {fmt(result.offenderRial / 10)} تومان • سهم صندوق: {fmt(result.fundRial / 10)} تومان
              </p>
            )}
          </section>
        )}

        {result.notes.length > 0 && (
          <ul className="space-y-1.5 rounded-2xl bg-surface-2/60 p-4 text-[12.5px] leading-6 text-muted">
            {result.notes.map((n, i) => (
              <li key={i}>• {toFaDigits(n)}</li>
            ))}
            <li>• جراحات غیر سر و صورت به نسبت دیه همان عضو محاسبه می‌شود (ماده ۷۱۰) و موارد فاقد دیه مقدر «ارش» دارند که دادگاه با جلب نظر کارشناس تعیین می‌کند (ماده ۴۴۹).</li>
          </ul>
        )}
        <Disclaimer />
      </main>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="انتخاب صدمه">
        <Segmented value={group} onChange={setGroup} options={GROUPS.map((g) => ({ value: g, label: g }))} />
        <ul className="mt-3 divide-y divide-line">
          {DIYEH_ITEMS.filter((i) => i.group === group).map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => add(i.id)} className="flex w-full items-center gap-3 py-3 text-start" disabled={items.some((s) => s.id === i.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{i.title}</span>
                  <span className="text-[12px] text-muted">
                    <span dir="ltr">{toFaDigits(`${i.fraction[0]}/${i.fraction[1]}`)}</span> دیه کامل • ماده {toFaDigits(i.article)}
                  </span>
                </span>
                {items.some((s) => s.id === i.id) ? <span className="text-[12px] text-ok">افزوده شد</span> : <Plus className="h-4.5 w-4.5 text-brand" />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}
