/**
 * محاسبه‌گر دیه — قانون مجازات اسلامی ۱۳۹۲
 * مبانی: ماده ۵۴۹ (تعیین سالانه مبلغ دیه کامل)، ۵۵۰ (دیه زن)، تبصره ماده ۵۵۱ (پرداخت مابه‌التفاوت از صندوق)،
 * ۵۵۵ تا ۵۵۷ (تغلیظ فقط در قتل)، ۵۶۰ و ۵۶۱ (برابری تا ثلث در اعضا و منافع)، و مواد مربوط به هر صدمه.
 * کسرها مستقیماً از متن مواد استخراج شده‌اند (مرجع هر مورد در فیلد article).
 */
import { Fraction } from './fraction'

export interface DiyehRate {
  year: number
  /** دیه کامل در ماه‌های غیرحرام (ریال) */
  fullRial: number
  announced: string
  source: string
  url: string
}

/** نرخ رسمی اعلام‌شده؛ کاربر می‌تواند مبلغ پایه را دستی تغییر دهد */
export const DIYEH_RATES: DiyehRate[] = [
  {
    year: 1405,
    fullRial: 21_000_000_000,
    announced: '1404/12/27',
    source: 'بخشنامه رئیس قوه قضاییه در اجرای ماده ۵۴۹ ق.م.ا (مرکز رسانه قوه قضاییه به نقل از ایسنا)',
    url: 'https://www.asriran.com/fa/news/1150486',
  },
]

export type DiyehGroup = 'نفس' | 'اعضا' | 'منافع' | 'جراحات'

export interface DiyehItem {
  id: string
  group: DiyehGroup
  title: string
  fraction: [number, number]
  /** شماره ماده در قانون مجازات اسلامی */
  article: string
  perUnit?: boolean
  maxUnits?: number
  life?: boolean
}

export const DIYEH_ITEMS: DiyehItem[] = [
  { id: 'life', group: 'نفس', title: 'قتل نفس', fraction: [1, 1], article: '549', life: true },

  { id: 'eyes-both', group: 'اعضا', title: 'از بین بردن هر دو چشم بینا', fraction: [1, 1], article: '587' },
  { id: 'eye-one', group: 'اعضا', title: 'از بین بردن یک چشم بینا', fraction: [1, 2], article: '587' },
  { id: 'eye-blind', group: 'اعضا', title: 'از بین بردن چشم نابینا', fraction: [1, 6], article: '589' },
  { id: 'nose', group: 'اعضا', title: 'قطع تمام بینی', fraction: [1, 1], article: '592' },
  { id: 'nose-tip', group: 'اعضا', title: 'از بین بردن نوک بینی', fraction: [1, 2], article: '599' },
  { id: 'ears-both', group: 'اعضا', title: 'از بین بردن دو لاله گوش', fraction: [1, 1], article: '600' },
  { id: 'ear-one', group: 'اعضا', title: 'از بین بردن یک لاله گوش', fraction: [1, 2], article: '600' },
  { id: 'lips-both', group: 'اعضا', title: 'از بین بردن دو لب', fraction: [1, 1], article: '607' },
  { id: 'lip-one', group: 'اعضا', title: 'از بین بردن یک لب', fraction: [1, 2], article: '607' },
  { id: 'tongue', group: 'اعضا', title: 'قطع تمام زبان گویا', fraction: [1, 1], article: '611' },
  { id: 'tooth-front', group: 'اعضا', title: 'دندان جلو (پیش، چهارتایی، نیش) — هر عدد', fraction: [1, 20], article: '616', perUnit: true, maxUnits: 12 },
  { id: 'tooth-back', group: 'اعضا', title: 'دندان عقب (ضاحک و ضرس) — هر عدد', fraction: [1, 40], article: '616', perUnit: true, maxUnits: 16 },
  { id: 'tooth-milk', group: 'اعضا', title: 'کندن دندان شیری — هر عدد', fraction: [1, 100], article: '623', perUnit: true, maxUnits: 20 },
  { id: 'hand', group: 'اعضا', title: 'قطع یک دست از مچ (با انگشتان کامل)', fraction: [1, 2], article: '635' },
  { id: 'finger', group: 'اعضا', title: 'انگشت اصلی دست — هر عدد', fraction: [1, 10], article: '641', perUnit: true, maxUnits: 10 },
  { id: 'foot', group: 'اعضا', title: 'قطع یک پا از مچ (با انگشتان کامل)', fraction: [1, 2], article: '646' },
  { id: 'toe', group: 'اعضا', title: 'انگشت اصلی پا — هر عدد', fraction: [1, 10], article: '646', perUnit: true, maxUnits: 10 },
  { id: 'nail', group: 'اعضا', title: 'از بین بردن ناخن (نروید یا معیوب بروید) — هر عدد', fraction: [1, 100], article: '645', perUnit: true, maxUnits: 20 },
  { id: 'spinal-cord', group: 'اعضا', title: 'قطع نخاع', fraction: [1, 1], article: '648' },

  { id: 'mind', group: 'منافع', title: 'زائل کردن عقل', fraction: [1, 1], article: '675' },
  { id: 'hearing-both', group: 'منافع', title: 'از بین بردن شنوایی هر دو گوش', fraction: [1, 1], article: '682' },
  { id: 'hearing-one', group: 'منافع', title: 'از بین بردن شنوایی یک گوش', fraction: [1, 2], article: '682' },
  { id: 'sight-both', group: 'منافع', title: 'از بین بردن بینایی هر دو چشم', fraction: [1, 1], article: '689' },
  { id: 'sight-one', group: 'منافع', title: 'از بین بردن بینایی یک چشم', fraction: [1, 2], article: '689' },
  { id: 'smell', group: 'منافع', title: 'از بین بردن کامل بویایی', fraction: [1, 1], article: '693' },
  { id: 'speech', group: 'منافع', title: 'از بین بردن کامل گویایی (بدون قطع زبان)', fraction: [1, 1], article: '698' },

  { id: 'harise', group: 'جراحات', title: 'حارصه (خراش پوست بدون جریان خون) — سر و صورت', fraction: [1, 100], article: '709', perUnit: true, maxUnits: 10 },
  { id: 'damiye', group: 'جراحات', title: 'دامیه (ورود اندک به گوشت با خون) — سر و صورت', fraction: [2, 100], article: '709', perUnit: true, maxUnits: 10 },
  { id: 'motalaheme', group: 'جراحات', title: 'متلاحمه (بریدگی عمیق گوشت) — سر و صورت', fraction: [3, 100], article: '709', perUnit: true, maxUnits: 10 },
  { id: 'samhagh', group: 'جراحات', title: 'سمحاق (رسیدن به پوست نازک روی استخوان) — سر و صورت', fraction: [4, 100], article: '709', perUnit: true, maxUnits: 10 },
  { id: 'mouzehe', group: 'جراحات', title: 'موضحه (آشکار شدن استخوان) — سر و صورت', fraction: [5, 100], article: '709', perUnit: true, maxUnits: 10 },
  { id: 'hasheme', group: 'جراحات', title: 'هاشمه (شکستگی استخوان) — سر و صورت', fraction: [10, 100], article: '709', perUnit: true, maxUnits: 10 },
  { id: 'monaghele', group: 'جراحات', title: 'منقّله (نیاز به جابه‌جایی استخوان) — سر و صورت', fraction: [15, 100], article: '709', perUnit: true, maxUnits: 10 },
  { id: 'mamoume', group: 'جراحات', title: 'مأمومه (رسیدن جراحت به کیسه مغز)', fraction: [1, 3], article: '709', perUnit: true, maxUnits: 3 },
  { id: 'jaefe', group: 'جراحات', title: 'جائفه (جراحت نافذ به درون بدن)', fraction: [1, 3], article: '711', perUnit: true, maxUnits: 4 },
]

export interface DiyehSelection {
  id: string
  units: number
}

export interface DiyehInput {
  baseRial: number
  victim: 'male' | 'female'
  /** رفتار مرتکب و فوت هر دو در ماه‌های حرام یا در حرم مکه (ماده ۵۵۵) */
  haram: boolean
  items: DiyehSelection[]
}

export interface DiyehLine {
  item: DiyehItem
  units: number
  fraction: Fraction
  manRial: number
  offenderRial: number
  fundRial: number
  halved: boolean
  taghlizRial: number
}

export interface DiyehResult {
  lines: DiyehLine[]
  offenderRial: number
  fundRial: number
  totalRial: number
  notes: string[]
}

const THIRD = Fraction.of(1, 3)

export function calculateDiyeh(input: DiyehInput): DiyehResult {
  const lines: DiyehLine[] = []
  const notes = new Set<string>()
  for (const sel of input.items) {
    const item = DIYEH_ITEMS.find((i) => i.id === sel.id)
    if (!item) continue
    const units = item.perUnit ? Math.max(1, Math.min(item.maxUnits ?? 99, Math.floor(sel.units || 1))) : 1
    const fr = Fraction.of(item.fraction[0], item.fraction[1]).mul(units)
    const manBase = fr.toNumber() * input.baseRial
    let taghliz = 0
    if (item.life && input.haram) {
      taghliz = manBase / 3
      notes.add('تغلیظ: افزایش یک‌سوم دیه در قتلی که رفتار و فوت هر دو در ماه‌های حرام یا حرم مکه واقع شود (ماده ۵۵۵)؛ تغلیظ مخصوص قتل نفس است (ماده ۵۵۷).')
    }
    const man = manBase + taghliz
    let offender = man
    let halved = false
    if (input.victim === 'female') {
      if (item.life) {
        halved = true
        notes.add('دیه قتل زن نصف دیه مرد است (ماده ۵۵۰).')
      } else if (fr.cmp(THIRD) >= 0) {
        halved = true
        notes.add('دیه زن و مرد در اعضا و منافع تا کمتر از ثلث دیه کامل یکسان است و از ثلث به بالا نصف می‌شود (ماده ۵۶۰)؛ ملاک ثلث، هر آسیب به‌طور جداگانه است (ماده ۵۶۱).')
      }
      if (halved) {
        offender = man / 2
        notes.add('در جنایاتی که مجنی‌علیه مرد نیست، تفاوت دیه تا سقف دیه مرد از صندوق تأمین خسارت‌های بدنی پرداخت می‌شود (تبصره ماده ۵۵۱).')
      }
    }
    lines.push({ item, units, fraction: fr, manRial: man, offenderRial: offender, fundRial: man - offender, halved, taghlizRial: taghliz })
  }
  const offenderRial = lines.reduce((s, l) => s + l.offenderRial, 0)
  const fundRial = lines.reduce((s, l) => s + l.fundRial, 0)
  if (lines.some((l) => !l.item.life)) notes.add('تغلیظ دیه در جنایت بر اعضا و منافع جاری نیست (ماده ۵۵۷).')
  return { lines, offenderRial, fundRial, totalRial: offenderRial + fundRial, notes: [...notes] }
}
