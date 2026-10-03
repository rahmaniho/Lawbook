import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Minus, Plus, Scale } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { Disclaimer } from '../components/layout/Disclaimer'
import { Segmented } from '../components/ui/Segmented'
import { Switch } from '../components/ui/Switch'
import { calculateInheritance, type HeirsInput } from '../lib/inheritance'
import { toFaDigits, toLatinDigits } from '../lib/normalize'
import { articlePath } from '../lib/utils'

function Counter({ label, value, onChange, max = 20 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-[14.5px] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`کاهش ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 active:scale-90">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center text-lg font-bold" aria-live="polite">
          {toFaDigits(value)}
        </span>
        <button type="button" aria-label={`افزایش ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 active:scale-90">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-3">
      <span>
        <span className="block text-[14.5px] font-medium">{label}</span>
        {hint && <span className="block text-[12px] leading-5 text-muted">{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  )
}

const fmtMoney = (n: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(n)

export default function InheritancePage() {
  const [input, setInput] = useState<HeirsInput>({
    deceased: 'male',
    spouses: 1,
    father: true,
    mother: true,
    sons: 1,
    daughters: 1,
    motherHajib: false,
    otherRelatives: true,
  })
  const [estate, setEstate] = useState('')
  const set = (patch: Partial<HeirsInput>) => setInput((p) => ({ ...p, ...patch }))
  const result = useMemo(() => calculateInheritance(input), [input])
  const estateNum = Number(toLatinDigits(estate.replace(/[,٬\s]/g, ''))) || 0
  const noClassOne = !input.father && !input.mother && input.sons + input.daughters === 0

  return (
    <div className="pb-2">
      <AppBar back="/tools" title="محاسبه سهم‌الارث" subtitle="طبقه اول + همسر • قانون مدنی" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <p className="mb-2 text-sm font-bold">متوفی</p>
          <Segmented
            layoutId="deceased"
            value={input.deceased}
            onChange={(v) => set({ deceased: v, spouses: Math.min(input.spouses, v === 'female' ? 1 : 4) })}
            options={[
              { value: 'male', label: 'مرد' },
              { value: 'female', label: 'زن' },
            ]}
          />
          <div className="mt-2 divide-y divide-line">
            {input.deceased === 'male' ? (
              <Counter label="تعداد همسر دائم" value={input.spouses} onChange={(v) => set({ spouses: v })} max={4} />
            ) : (
              <Toggle label="شوهر در قید حیات" checked={input.spouses > 0} onChange={(v) => set({ spouses: v ? 1 : 0 })} />
            )}
            <Toggle label="پدر در قید حیات" checked={input.father} onChange={(v) => set({ father: v })} />
            <Toggle label="مادر در قید حیات" checked={input.mother} onChange={(v) => set({ mother: v })} />
            <Counter label="پسر" value={input.sons} onChange={(v) => set({ sons: v })} />
            <Counter label="دختر" value={input.daughters} onChange={(v) => set({ daughters: v })} />
            {input.father && input.mother && (
              <Toggle
                label="مادر حاجب دارد"
                hint="متوفی دست‌کم دو برادر، یا یک برادر و دو خواهر، یا چهار خواهر ابوینی/ابی دارد (بند ب ماده ۸۹۲)"
                checked={input.motherHajib}
                onChange={(v) => set({ motherHajib: v })}
              />
            )}
            {noClassOne && (
              <Toggle
                label="خویشاوند نسبی دیگری وجود دارد"
                hint="برادر/خواهر، اجداد، عمو/عمه/دایی/خاله یا فرزندان آنان"
                checked={input.otherRelatives}
                onChange={(v) => set({ otherRelatives: v })}
              />
            )}
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-bold">مبلغ خالص ترکه (اختیاری، تومان)</span>
            <input
              inputMode="numeric"
              value={estate}
              onChange={(e) => setEstate(e.target.value)}
              placeholder="مثلاً ۲۰۰۰۰۰۰۰۰۰"
              className="h-11 w-full rounded-xl border border-line bg-surface-2/50 px-3 text-[15px] outline-none focus:border-brand/60"
            />
          </label>
        </section>

        {!result.ok ? (
          <section className="flex items-start gap-3 rounded-card border border-accent/30 bg-accent-soft/60 p-4 text-[14px] leading-7">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-accent" />
            <p>{result.error}</p>
          </section>
        ) : (
          <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 font-extrabold">
              <Scale className="h-5 w-5 text-brand" /> سهم هر وارث
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-[13.5px]">
                <thead className="bg-surface-2 text-[12px] text-muted">
                  <tr>
                    <th className="p-2.5 text-start font-medium">وارث</th>
                    <th className="p-2.5 font-medium">سهم کل</th>
                    <th className="p-2.5 font-medium">سهم هر نفر</th>
                    {estateNum > 0 && <th className="p-2.5 font-medium">مبلغ هر نفر</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.shares.map((s) => (
                    <tr key={s.kind}>
                      <td className="p-2.5">
                        <span className="font-bold">{s.label}</span>
                        {s.count > 1 && <span className="text-muted"> × {toFaDigits(s.count)}</span>}
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {s.refs.map((r) => (
                            <Link key={r} to={articlePath('civil-code', r)} className="text-[11px] text-brand underline">
                              م {toFaDigits(r)}
                            </Link>
                          ))}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-bold" dir="ltr">
                        {toFaDigits(s.total.toString())}
                        <span className="block text-[11px] font-normal text-muted">{toFaDigits((s.total.toNumber() * 100).toFixed(2))}٪</span>
                      </td>
                      <td className="p-2.5 text-center" dir="ltr">
                        {toFaDigits(s.each.toString())}
                      </td>
                      {estateNum > 0 && <td className="p-2.5 text-center text-[12.5px]">{fmtMoney(s.each.toNumber() * estateNum)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mb-2 mt-4 text-sm font-bold">مراحل محاسبه</h3>
            <ol className="list-inside list-decimal space-y-1.5 text-[13.5px] leading-7">
              {result.steps.map((s, i) => (
                <li key={i}>{toFaDigits(s)}</li>
              ))}
            </ol>
            {result.notes.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-2xl bg-surface-2/60 p-3 text-[12.5px] leading-6 text-muted">
                {result.notes.map((n, i) => (
                  <li key={i}>• {toFaDigits(n)}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-surface-2/60 p-4 text-[12.5px] leading-6 text-muted">
          <b className="text-fg">محدوده محاسبه:</b> فقط طبقه اول (پدر، مادر، پسر، دختر) و همسر دائم. نوه‌ها (قائم‌مقامی)، طبقات دوم و سوم، حمل، موانع ارث (مواد
          ۸۸۰ تا ۸۸۴) و موارد خاص (طلاق رجعی، ازدواج در حال مرض و …) محاسبه نمی‌شوند.
        </section>
        <Disclaimer />
      </main>
    </div>
  )
}
