/**
 * «فهرست مصوبات» — نمایه عناوین سامانه ملی قوانین و مقررات (qavanin.ir)
 *
 * مشترک میان اسکریپت ساخت (scripts/bundle-data.ts)، Web Worker جستجو و رابط کاربری.
 * فهرست فقط «عنوان و مشخصات» مصوبات است؛ متن رسمی هر مورد در سامانه ملی قوانین است
 * و متن کامل در اپ فقط برای قوانین موجود در data/laws/ ارائه می‌شود.
 */
import type { HierarchyId } from '../types'
import { normalizeSearch, TOKEN_SPLIT_RE, ZWNJ } from '../normalize'

export type QType = 'constitution' | 'statute' | 'regulation' | 'local' | 'precedent' | 'advisory' | 'other'

export interface QTypeInfo {
  id: QType
  title: string
  short: string
  hierarchy?: HierarchyId
}

/** ترتیب انواع = ترتیب سلسله‌مراتب حقوقی */
export const Q_TYPES: QTypeInfo[] = [
  { id: 'constitution', title: 'قانون اساسی، متمم و نظرهای تفسیری شورای نگهبان', short: 'اساسی', hierarchy: 'constitution' },
  { id: 'statute', title: 'قوانین و لوایح قانونی', short: 'قوانین', hierarchy: 'statute' },
  { id: 'regulation', title: 'مقررات دولتی (تصویب‌نامه، آیین‌نامه، مصوبات شوراهای عالی و دستگاه‌ها)', short: 'مقررات', hierarchy: 'regulation' },
  { id: 'local', title: 'مصوبات شوراهای اسلامی شهر و روستا', short: 'شوراها', hierarchy: 'local' },
  { id: 'precedent', title: 'آرای دیوان عالی کشور و هیئت عمومی دیوان عدالت اداری', short: 'آرا', hierarchy: 'precedent' },
  { id: 'advisory', title: 'نظریات مشورتی اداره کل حقوقی قوه قضاییه', short: 'نظریات', hierarchy: 'advisory' },
  { id: 'other', title: 'سایر (احکام و سیاست‌های رهبری، نظرهای رئیس مجلس و …)', short: 'سایر' },
]

export const Q_TYPE_IDS = Q_TYPES.map((t) => t.id)
export const qTypeIndex = (t: QType) => Q_TYPE_IDS.indexOf(t)
export const qTypeInfo = (t: QType) => Q_TYPES.find((x) => x.id === t)!

export const QAVANIN_LAW_URL = 'https://qavanin.ir/Law/TreeText/{id}'
export const qavaninUrl = (id: number | string) => QAVANIN_LAW_URL.replace('{id}', String(id))

/** خلاصه فهرست (در کاتالوگ ذخیره می‌شود تا شمارش‌ها بدون دریافت فهرست نمایش داده شوند) */
export interface QIndexSummary {
  count: number
  latestDate: string
  earliestYear: number
  byType: Partial<Record<QType, number>>
  /** حجم خام بسته‌ها */
  bytes: number
  /** حجم انتقال با فشرده‌سازی gzip (با brotli کمتر) */
  transferBytes: number
  version: string
}

export interface QIndexChunkInfo {
  file: string
  hash: string
  count: number
  bytes: number
}

export interface QIndexManifest extends QIndexSummary {
  schemaVersion: number
  generatedAt: string
  linkTemplate: string
  source: { name: string; url: string; via: string; file: string }
  types: { id: QType; count: number; chunks: QIndexChunkInfo[] }[]
  /** مراجع تصویب (به ترتیب فراوانی) */
  authorities: string[]
  authorityCounts: number[]
  /** شناسه سامانه → شناسه قانون دارای متن کامل در اپ */
  inApp: Record<string, string>
}

/** بسته ستونی فهرست (هر بسته حداکثر ~۵۰۰KB) */
export interface QIndexChunk {
  type: QType
  ids: number[]
  titles: string[]
  dates: string[]
  auth: number[]
}

export interface QEntry {
  id: number
  title: string
  date: string
  authority: string
  type: QType
  lawId?: string
}

// ---------------------------------------------------------------------------
// طبقه‌بندی بر اساس مرجع تصویب و عنوان (روی متن نرمال‌شده برای جستجو)

const n = (s: string) => normalizeSearch(s).replace(/\u200c/g, ' ').replace(/ {2,}/g, ' ')

const LEGISLATIVE = new Set(
  ['مجلس شورای ملی', 'مجلس شورای اسلامی', 'مجلس سنا', 'مجمع تشخیص مصلحت نظام', 'شورای انقلاب جمهوری اسلامی ایران', 'همه پرسی', 'مجلس موسسان', 'کمیسیون دادگستری'].map(n),
)
/** مراجعی که «لوایح/تصمیمات قانونی» آن‌ها در حکم قانون است (فقط وقتی عنوان با «قانون/لایحه قانونی» شروع شود) */
const QUASI_LEGISLATIVE = new Set(['نخست وزیر (مصدق)', 'هیات وزیران (دوره فترت)', 'وزیر عدلیه (داور)', 'پادشاه وقت'].map(n))
const CONSTITUENT = new Set(['همه پرسی', 'مجلس موسسان', 'پادشاه وقت', 'مجلس خبرگان قانون اساسی', 'مجلس بررسی نهایی قانون اساسی'].map(n))
const LEADERSHIP_RE = /(مقام معظم رهبری|فرمانده(ی)? کل قوا|دفتر مقام معظم رهبری)/
const STATUTE_TITLE_RE = /^(قانون|لایحه قانونی|تصمیم قانونی|متمم قانون)/

export function classifyEntry(title: string, authority: string): QType {
  const t = n(title)
  const a = n(authority)
  if (a.includes('اداره کل حقوقی') || t.startsWith('نظریه مشورتی')) return 'advisory'
  if (a === n('شورای نگهبان')) return t.includes('تفسیر') || t.includes('تفسیری') ? 'constitution' : 'other'
  if (t.includes('قانون اساسی') && (CONSTITUENT.has(a) || /^(قانون اساسی|متمم قانون اساسی|اصلاحات و تغییرات و تتمیم قانون اساسی|اصول اصلاحی)/.test(t)))
    return 'constitution'
  if (a === n('دیوان عدالت اداری') || a === n('دیوان عالی کشور') || t.startsWith('رای وحدت رویه')) return 'precedent'
  if (/شورای اسلامی (شهر|روستا|استان|بخش)/.test(a) || a === n('شورای عالی استانها')) return 'local'
  if (LEGISLATIVE.has(a) || (a.startsWith('کمیسیون') && a.includes('مجلس'))) return 'statute'
  if (QUASI_LEGISLATIVE.has(a) && STATUTE_TITLE_RE.test(t)) return 'statute'
  if (LEADERSHIP_RE.test(a) || a === n('رییس مجلس') || a === n('رییس مجلس شورای اسلامی')) return 'other'
  return 'regulation'
}

// ---------------------------------------------------------------------------
// تطبیق متن: عنوان‌ها و پرس‌وجو بدون فاصله/نیم‌فاصله مقایسه می‌شوند تا «مالیات‌های»، «مالیاتهای» و
// «مالیات های» همگی یکسان باشند.

/** رشته فشرده قابل جستجوی یک عنوان */
export function matchKey(title: string): string {
  return normalizeSearch(title).replace(/[\s\u200c]+/g, '')
}

/** توکن‌های پرس‌وجو برای تطبیق زیررشته‌ای (طولانی‌ترین اول) */
export function matchTokens(query: string): string[] {
  const parts = normalizeSearch(query)
    .split(TOKEN_SPLIT_RE)
    .map((p) => p.split(ZWNJ).join(''))
    .filter(Boolean)
  return [...new Set(parts)].sort((a, b) => b.length - a.length)
}

/** سال تصویب از رشته تاریخ («1373/07/24» ← 1373) */
export function yearOf(date: string): number {
  const m = /^(\d{4})/.exec(date)
  const y = m ? Number(m[1]) : 0
  return y >= 1280 && y <= 1500 ? y : 0
}
