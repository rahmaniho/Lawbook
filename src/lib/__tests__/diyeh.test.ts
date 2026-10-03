import { describe, expect, it } from 'vitest'
import { calculateDiyeh } from '../diyeh'

const BASE = 21_000_000_000

describe('محاسبه دیه (ق.م.ا ۱۳۹۲)', () => {
  it('دندان جلو: یک‌بیستم دیه کامل (ماده ۶۱۶)', () => {
    const r = calculateDiyeh({ baseRial: BASE, victim: 'male', haram: false, items: [{ id: 'tooth-front', units: 2 }] })
    expect(r.totalRial).toBe(2_100_000_000)
  })
  it('قتل زن: نصف دیه + مابه‌التفاوت از صندوق (ماده ۵۵۰ و تبصره ۵۵۱)', () => {
    const r = calculateDiyeh({ baseRial: BASE, victim: 'female', haram: false, items: [{ id: 'life', units: 1 }] })
    expect(r.offenderRial).toBe(BASE / 2)
    expect(r.fundRial).toBe(BASE / 2)
  })
  it('تغلیظ در ماه حرام فقط برای قتل (ماده ۵۵۵ و ۵۵۷)', () => {
    const life = calculateDiyeh({ baseRial: BASE, victim: 'male', haram: true, items: [{ id: 'life', units: 1 }] })
    expect(life.totalRial).toBe(28_000_000_000)
    const eye = calculateDiyeh({ baseRial: BASE, victim: 'male', haram: true, items: [{ id: 'eye-one', units: 1 }] })
    expect(eye.totalRial).toBe(BASE / 2)
  })
  it('دیه زن در اعضا تا کمتر از ثلث برابر، از ثلث به بالا نصف (ماده ۵۶۰)', () => {
    const tooth = calculateDiyeh({ baseRial: BASE, victim: 'female', haram: false, items: [{ id: 'tooth-front', units: 1 }] })
    expect(tooth.lines[0].halved).toBe(false)
    expect(tooth.offenderRial).toBe(BASE / 20)
    const eye = calculateDiyeh({ baseRial: BASE, victim: 'female', haram: false, items: [{ id: 'eye-one', units: 1 }] })
    expect(eye.lines[0].halved).toBe(true)
    expect(eye.offenderRial).toBe(BASE / 4)
    expect(eye.fundRial).toBe(BASE / 4)
  })
})
