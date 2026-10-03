import { describe, expect, it } from 'vitest'
import { calculateInheritance, type HeirsInput } from '../inheritance'

const base: HeirsInput = { deceased: 'male', spouses: 0, father: false, mother: false, sons: 0, daughters: 0, motherHajib: false, otherRelatives: false }
const shares = (input: Partial<HeirsInput>) => {
  const r = calculateInheritance({ ...base, ...input })
  expect(r.ok, r.error).toBe(true)
  return Object.fromEntries(r.shares.map((s) => [s.kind, s.total.toString()]))
}

describe('محاسبه ارث طبقه اول (قانون مدنی)', () => {
  it('زوجه + یک پسر + یک دختر: ۱/۸ و باقی ۲ به ۱', () => {
    expect(shares({ spouses: 1, sons: 1, daughters: 1 })).toEqual({ wife: '1/8', son: '7/12', daughter: '7/24' })
  })
  it('شوهر + پدر + مادر (بدون فرزند): ۱/۲، ۱/۳، ۱/۶', () => {
    expect(shares({ deceased: 'female', spouses: 1, father: true, mother: true })).toEqual({ husband: '1/2', mother: '1/3', father: '1/6' })
  })
  it('ابوین + یک دختر: رد به نسبت فروض (ماده ۹۰۸)', () => {
    expect(shares({ father: true, mother: true, daughters: 1 })).toEqual({ father: '1/5', mother: '1/5', daughter: '3/5' })
  })
  it('ابوین + یک دختر با حاجب مادر: مادر از رد سهم نمی‌برد', () => {
    expect(shares({ father: true, mother: true, daughters: 1, motherHajib: true })).toEqual({ father: '5/24', mother: '1/6', daughter: '5/8' })
  })
  it('زوجه + ابوین + دو دختر: نقص بر دختران', () => {
    expect(shares({ spouses: 1, father: true, mother: true, daughters: 2 })).toEqual({ wife: '1/8', father: '1/6', mother: '1/6', daughter: '13/24' })
  })
  it('شوهر + پدر + یک دختر: رد به پدر و دختر، نه شوهر', () => {
    expect(shares({ deceased: 'female', spouses: 1, father: true, daughters: 1 })).toEqual({ husband: '1/4', father: '3/16', daughter: '9/16' })
  })
  it('فقط زوجه: ربع، باقی در حکم مال بلاوارث (ماده ۹۴۹)', () => {
    expect(shares({ spouses: 1 })).toEqual({ wife: '1/4', imam: '3/4' })
  })
  it('فقط شوهر: تمام ترکه', () => {
    expect(shares({ deceased: 'female', spouses: 1 })).toEqual({ husband: '1' })
  })
  it('بدون فرزند، مادر با حاجب: سدس', () => {
    expect(shares({ father: true, mother: true, motherHajib: true })).toEqual({ father: '5/6', mother: '1/6' })
  })
  it('دو زوجه: ثمن به تساوی', () => {
    const r = calculateInheritance({ ...base, spouses: 2, sons: 1 })
    const wife = r.shares.find((s) => s.kind === 'wife')!
    expect(wife.total.toString()).toBe('1/8')
    expect(wife.each.toString()).toBe('1/16')
  })
  it('بدون طبقه اول ولی با خویشاوندان دیگر: پشتیبانی نمی‌شود', () => {
    expect(calculateInheritance({ ...base, spouses: 1, otherRelatives: true }).ok).toBe(false)
  })
})
