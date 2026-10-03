/**
 * محاسبه‌گر سهم‌الارث — طبقه اول (پدر، مادر، پسران، دختران) به همراه همسر
 * مبنا: قانون مدنی، مواد ۸۶۲ تا ۹۴۹ (به‌ویژه ۸۹۲، ۸۹۹–۹۰۹، ۹۱۳، ۹۴۲، ۹۴۶ و ۹۴۹)
 *
 * محدوده عمداً محدود است تا خطای حقوقی رخ ندهد:
 * - نوه‌ها (قائم‌مقامی)، طبقات دوم و سوم، حمل، ممنوعیت از ارث (قتل، کفر، لعان) و ارث در عقد موقت پشتیبانی نمی‌شوند.
 * - کسر «نقص» در صورت تجاوز فروض از ترکه، طبق فقه امامیه (عدم عول) بر دختر/دختران وارد می‌شود.
 */
import { Fraction, sum } from './fraction'

export interface HeirsInput {
  deceased: 'male' | 'female'
  /** تعداد زوجه دائم (اگر متوفی مرد باشد: ۰ تا ۴) یا وجود زوج (۰/۱) اگر متوفی زن باشد */
  spouses: number
  father: boolean
  mother: boolean
  sons: number
  daughters: number
  /** وجود حاجب برای مادر طبق بند «ب» ماده ۸۹۲ (دو برادر، یا یک برادر و دو خواهر، یا چهار خواهر ابوینی/ابی) */
  motherHajib: boolean
  /** آیا خویشاوند نسبی دیگری (طبقه دوم یا سوم) وجود دارد؟ فقط وقتی طبقه اول وجود ندارد اهمیت دارد */
  otherRelatives: boolean
}

export type HeirKind = 'husband' | 'wife' | 'father' | 'mother' | 'son' | 'daughter' | 'imam'

export interface HeirShare {
  kind: HeirKind
  label: string
  count: number
  total: Fraction
  each: Fraction
  refs: string[]
  note?: string
}

export interface InheritanceResult {
  ok: boolean
  error?: string
  shares: HeirShare[]
  steps: string[]
  notes: string[]
}

const LABELS: Record<HeirKind, string> = {
  husband: 'شوهر',
  wife: 'همسر (زوجه)',
  father: 'پدر',
  mother: 'مادر',
  son: 'پسر',
  daughter: 'دختر',
  imam: 'در حکم مال بلاوارث — امر آن راجع به حاکم (مواد ۹۴۹ و ۸۶۶)',
}

const f = Fraction.of

export function calculateInheritance(input: HeirsInput): InheritanceResult {
  const steps: string[] = []
  const notes: string[] = []
  const shares: HeirShare[] = []
  const { father, mother } = input
  const sons = Math.max(0, Math.floor(input.sons))
  const daughters = Math.max(0, Math.floor(input.daughters))
  const spouses = Math.max(0, Math.floor(input.spouses))

  if (input.deceased === 'female' && spouses > 1) return { ok: false, error: 'زن متوفی تنها یک شوهر می‌تواند داشته باشد.', shares, steps, notes }
  if (input.deceased === 'male' && spouses > 4) return { ok: false, error: 'حداکثر چهار زوجه دائم قابل محاسبه است.', shares, steps, notes }

  const hasChildren = sons + daughters > 0
  const hasParents = father || mother
  const spouseKind: HeirKind = input.deceased === 'female' ? 'husband' : 'wife'
  // حجب مادر فقط وقتی پدر زنده باشد (بند «ب» ماده ۸۹۲، شرط دوم)
  const motherHajib = input.motherHajib && father

  // سهم همسر (مواد ۸۹۹، ۹۰۰، ۹۰۱، ۹۱۳)
  let spouseShare = Fraction.ZERO
  if (spouses > 0) {
    if (spouseKind === 'husband') spouseShare = hasChildren ? f(1, 4) : f(1, 2)
    else spouseShare = hasChildren ? f(1, 8) : f(1, 4)
    steps.push(
      `${LABELS[spouseKind]}: ${spouseShare.toString()} ترکه ${hasChildren ? '(متوفی فرزند دارد)' : '(متوفی فرزند ندارد)'} — مواد ${spouseKind === 'husband' ? (hasChildren ? '۹۰۰' : '۸۹۹') : hasChildren ? '۹۰۱' : '۹۰۰'} و ۹۱۳`,
    )
  }

  // بدون وارث طبقه اول
  if (!hasChildren && !hasParents) {
    if (input.otherRelatives)
      return {
        ok: false,
        error: 'در نبود وارث طبقه اول، ترکه به طبقه دوم یا سوم می‌رسد؛ این محاسبه‌گر فعلاً فقط طبقه اول را پشتیبانی می‌کند (ماده ۸۶۳).',
        shares,
        steps,
        notes,
      }
    if (spouses === 0) return { ok: false, error: 'هیچ وارثی مشخص نشده است.', shares, steps, notes }
    if (spouseKind === 'husband') {
      shares.push({ kind: 'husband', label: LABELS.husband, count: 1, total: Fraction.ONE, each: Fraction.ONE, refs: ['905', '949'], note: 'نصف به فرض و باقی به رد' })
      steps.push('در نبود هیچ وارث دیگر، زاید از فریضه به شوهر رد می‌شود و تمام ترکه را می‌برد (مواد ۹۰۵ و ۹۴۹).')
    } else {
      shares.push({ kind: 'wife', label: LABELS.wife, count: spouses, total: f(1, 4), each: f(1, 4).div(spouses), refs: ['900', '942', '949'] })
      shares.push({ kind: 'imam', label: LABELS.imam, count: 1, total: f(3, 4), each: f(3, 4), refs: ['949', '866'] })
      steps.push('زن فقط نصیب خود (ربع) را می‌برد و بقیه ترکه در حکم مال بلاوارث و تابع ماده ۸۶۶ است (ماده ۹۴۹).')
    }
    return finalize({ shares, steps, notes, input })
  }

  if (spouses > 0) {
    shares.push({ kind: spouseKind, label: LABELS[spouseKind], count: spouses, total: spouseShare, each: spouseShare.div(spouses), refs: ['913', spouseKind === 'wife' ? '942' : '900'] })
  }
  const rest = Fraction.ONE.sub(spouseShare)

  if (hasChildren) {
    const parentEach = f(1, 6)
    const parentCount = (father ? 1 : 0) + (mother ? 1 : 0)
    const parentsFard = parentEach.mul(parentCount)
    if (sons > 0) {
      // پدر و مادر هر کدام سدس؛ باقی به اولاد به قرابت، پسر دو برابر دختر (مواد ۸۹۲ الف، ۹۰۴، ۹۰۷)
      if (father) shares.push({ kind: 'father', label: LABELS.father, count: 1, total: parentEach, each: parentEach, refs: ['904', '892'] })
      if (mother) shares.push({ kind: 'mother', label: LABELS.mother, count: 1, total: parentEach, each: parentEach, refs: ['904', '892'] })
      if (parentCount) steps.push(`هر یک از ابوین: ۱/۶ ترکه (ماده ۹۰۴ و بند الف ماده ۸۹۲).`)
      const children = rest.sub(parentsFard)
      const units = sons * 2 + daughters
      const unit = children.div(units)
      shares.push({ kind: 'son', label: LABELS.son, count: sons, total: unit.mul(2 * sons), each: unit.mul(2), refs: ['907'] })
      if (daughters) shares.push({ kind: 'daughter', label: LABELS.daughter, count: daughters, total: unit.mul(daughters), each: unit, refs: ['907'] })
      steps.push(`باقی‌مانده (${children.toString()}) میان فرزندان به قرابت تقسیم می‌شود؛ سهم پسر دو برابر دختر است (ماده ۹۰۷).`)
    } else {
      // فقط دختر/دختران
      const dFard = daughters === 1 ? f(1, 2) : f(2, 3)
      if (!parentCount) {
        shares.push({ kind: 'daughter', label: LABELS.daughter, count: daughters, total: rest, each: rest.div(daughters), refs: ['907', '899', '902'] })
        steps.push(`در نبود ابوین، تمام باقی‌مانده (${rest.toString()}) به ${daughters === 1 ? 'دختر' : 'دختران به تساوی'} می‌رسد (ماده ۹۰۷).`)
      } else {
        steps.push(`فرض ${daughters === 1 ? 'دختر منحصر: ۱/۲' : 'دو دختر یا بیشتر: ۲/۳'} (${daughters === 1 ? 'بند ۲ ماده ۸۹۹' : 'بند ۱ ماده ۹۰۲'})؛ فرض هر یک از ابوین: ۱/۶ (ماده ۹۰۴).`)
        const totalFard = spouseShare.add(parentsFard).add(dFard)
        let dTotal = dFard
        let fatherTotal = father ? parentEach : Fraction.ZERO
        let motherTotal = mother ? parentEach : Fraction.ZERO
        if (totalFard.cmp(Fraction.ONE) > 0) {
          dTotal = Fraction.ONE.sub(spouseShare).sub(parentsFard)
          steps.push(`مجموع فروض (${totalFard.toString()}) از ترکه بیشتر است؛ کسری بر ${daughters === 1 ? 'دختر' : 'دختران'} وارد می‌شود و سهم آنان ${dTotal.toString()} است.`)
          notes.push('ورود نقص بر دختر/دختران در فرض تجاوز فروض از ترکه، مطابق فقه امامیه (عدم پذیرش «عول») است؛ قانون مدنی در این مورد صراحت ندارد.')
        } else if (totalFard.cmp(Fraction.ONE) < 0) {
          const remainder = Fraction.ONE.sub(totalFard)
          const motherExcluded = mother && motherHajib
          const pool = [dFard, father ? parentEach : Fraction.ZERO, mother && !motherExcluded ? parentEach : Fraction.ZERO]
          const poolSum = sum(pool)
          dTotal = dFard.add(remainder.mul(dFard).div(poolSum))
          if (father) fatherTotal = parentEach.add(remainder.mul(parentEach).div(poolSum))
          if (mother && !motherExcluded) motherTotal = parentEach.add(remainder.mul(parentEach).div(poolSum))
          steps.push(
            `مازاد ترکه (${remainder.toString()}) به نسبت فروض میان ${daughters === 1 ? 'دختر' : 'دختران'} و ${parentCount === 2 ? (motherExcluded ? 'پدر' : 'ابوین') : father ? 'پدر' : 'مادر'} رد می‌شود${spouses ? '؛ به همسر رد نمی‌شود (ماده ۹۰۵)' : ''}${motherExcluded ? '؛ مادر به‌دلیل داشتن حاجب از رد سهمی نمی‌برد' : ''} (مواد ${daughters === 1 ? '۹۰۸' : '۹۰۹'}).`,
          )
        }
        if (father) shares.push({ kind: 'father', label: LABELS.father, count: 1, total: fatherTotal, each: fatherTotal, refs: ['904', daughters === 1 ? '908' : '909'] })
        if (mother) shares.push({ kind: 'mother', label: LABELS.mother, count: 1, total: motherTotal, each: motherTotal, refs: ['904', daughters === 1 ? '908' : '909', '892'] })
        shares.push({ kind: 'daughter', label: LABELS.daughter, count: daughters, total: dTotal, each: dTotal.div(daughters), refs: [daughters === 1 ? '899' : '902', daughters === 1 ? '908' : '909'] })
      }
    }
  } else {
    // بدون فرزند، با ابوین (ماده ۹۰۶)
    if (father && mother) {
      const m = motherHajib ? f(1, 6) : f(1, 3)
      const fa = rest.sub(m)
      shares.push({ kind: 'father', label: LABELS.father, count: 1, total: fa, each: fa, refs: ['906'] })
      shares.push({ kind: 'mother', label: LABELS.mother, count: 1, total: m, each: m, refs: motherHajib ? ['906', '892'] : ['903', '906'] })
      steps.push(
        motherHajib
          ? 'مادر به‌علت وجود حاجب (بند ب ماده ۸۹۲) سدس می‌برد و بقیه مال پدر است (ماده ۹۰۶).'
          : 'مادر یک‌سوم ترکه را به فرض می‌برد (بند ۱ ماده ۹۰۳) و بقیه به پدر می‌رسد (ماده ۹۰۶).',
      )
    } else {
      const kind: HeirKind = father ? 'father' : 'mother'
      shares.push({ kind, label: LABELS[kind], count: 1, total: rest, each: rest, refs: ['906'] })
      steps.push(`${LABELS[kind]} در صورت انفراد تمام باقی‌مانده ترکه (${rest.toString()}) را می‌برد (ماده ۹۰۶).`)
    }
  }

  return finalize({ shares, steps, notes, input })
}

function finalize({ shares, steps, notes, input }: { shares: HeirShare[]; steps: string[]; notes: string[]; input: HeirsInput }): InheritanceResult {
  const total = sum(shares.map((s) => s.total))
  if (total.cmp(Fraction.ONE) !== 0) {
    return { ok: false, error: `خطای داخلی: مجموع سهام ${total.toString()} است.`, shares, steps, notes }
  }
  if (shares.some((s) => s.kind === 'wife')) {
    notes.push('زوجه از عین اموال منقول و از قیمت اموال غیرمنقول (اعم از عرصه و اعیان) ارث می‌برد (ماده ۹۴۶ اصلاحی ۱۳۸۷).')
    if (input.spouses > 1) notes.push('در صورت تعدد زوجات، ربع یا ثمن ترکه بین آنان به تساوی تقسیم می‌شود (ماده ۹۴۲).')
  }
  notes.push('محاسبه پس از کسر هزینه‌های کفن و دفن، دیون و واجبات مالی و وصیت (تا ثلث) از ترکه انجام می‌شود (مواد ۸۶۸–۸۶۹).')
  return { ok: true, shares: shares.filter((s) => !s.total.isZero() || s.kind === 'mother'), steps, notes }
}
