/** انواع داده‌ای مشترک اپ، Service Worker و Web Worker جستجو */

export type ArticleStatus = 'لازم‌الاجرا' | 'منسوخ' | 'اصلاحی'

export type HierarchyId = 'sharia' | 'constitution' | 'statute' | 'regulation' | 'local' | 'precedent' | 'advisory'

export type CategoryId =
  | 'public'
  | 'civil'
  | 'criminal'
  | 'family'
  | 'commercial'
  | 'labor'
  | 'administrative'
  | 'civil-procedure'
  | 'tax'
  | 'other'

export type DocType =
  | 'قانون اساسی'
  | 'قانون'
  | 'لایحه قانونی'
  | 'آیین‌نامه'
  | 'تصویب‌نامه'
  | 'رأی وحدت رویه'
  | 'نظریه مشورتی'
  | 'مصوبه شورا'
  | 'موازین شرع'

/** گروه‌بندی نوع سند برای فیلتر جستجو */
export type DocGroup = 'law' | 'regulation' | 'ruling'

export interface Amendment {
  kind: 'اصلاحی' | 'الحاقی' | 'منسوخ' | 'ملغی' | 'حذف' | 'یادداشت' | string
  date?: string
  raw: string
}

/** رابط ماده قانونی (مطابق مشخصات پروژه + چند فیلد کمکی) */
export interface Article {
  id: string // «civil-code:10»
  lawId: string
  lawTitle: string
  category: CategoryId
  hierarchy: HierarchyId
  docType: DocType
  chapter?: string
  section?: string
  headingId?: string
  articleNumber: number | string
  key: string // «10» یا «499-bis»
  order: number
  label: string // «ماده 10»
  text: string
  notes?: string[]
  amendments?: Amendment[]
  status: ArticleStatus
  relatedArticles?: string[]
  keywords: string[]
  sourceUrl?: string
  approvalYear?: number
}

export interface TocNode {
  id: string
  title: string
  parent: string | null
  depth: number
  first: string | null
  count: number
}

export interface LawSource {
  kind: 'qavanin-text' | 'pending' | string
  origin?: string | null
  upstream?: string | null
  license?: string | null
  url?: string | null
  rawFile?: string
  rawSha256?: string
  snapshotDate?: string | null
  snapshotDateJalali?: string | null
  verification: 'source-copy' | 'verified' | 'pending' | 'info' | string
  /** شناسه مصوبه در سامانه ملی قوانین و مقررات (qavanin.ir) */
  qavaninId?: number | null
  /** پیوند متن رسمی: https://qavanin.ir/Law/TreeText/{qavaninId} */
  officialUrl?: string | null
}

/** عضو یک مجموعه (مثلاً قوانین برنامه‌های توسعه) */
export interface LawMember {
  title: string
  qavaninId?: number
  date?: string
  authority?: string
  note?: string
}

export interface Law {
  id: string
  title: string
  shortTitle: string
  aliases: string[]
  hierarchy: HierarchyId
  category: CategoryId
  docType: DocType
  unit: string
  status: ArticleStatus | string
  priority: number
  featured: boolean
  approval: { date?: string; year?: number; authority?: string; note?: string }
  approvalNote?: string | null
  description?: string | null
  crossLinks: string[]
  related?: { lawId: string; key: string }[]
  expectedGaps?: { from: number; to: number; reason: string }[]
  expectedArticles?: number | null
  kind?: 'law' | 'collection' | 'info'
  members?: LawMember[]
  /** نمای فهرست مصوبات مرتبط (برای مجموعه‌هایی مانند آرای وحدت رویه و نظریات مشورتی) */
  qindex?: { type: string; authority?: string }
  /** متن این مورد با شماره‌گذاری دیگری در قانون دیگری موجود است */
  seeAlso?: { lawId: string; key: string; label: string; offset?: number; max?: number }
  source: LawSource
  lastUpdated: string | null
  contentHash?: string
  stats: { articles: number; notes?: number; repealed?: number; amended?: number; headings?: number; characters?: number }
  available: boolean
  toc?: TocNode[]
  preamble?: string
}

export interface CategoryInfo {
  id: CategoryId
  title: string
  icon: string
  subtopics?: { title: string; laws: string[] }[]
}

export interface CatalogFile {
  schemaVersion: number
  hierarchy: { id: HierarchyId; rank: number; title: string; description: string }[]
  categories: CategoryInfo[]
  laws: Law[]
  /** خلاصه «فهرست مصوبات» سامانه ملی قوانین (src/lib/qindex) */
  qindex?: import('./qindex/model').QIndexSummary
}

export interface GlossaryConcept {
  term: string
  match: string[]
  expand: string[]
}

export interface DataManifest {
  schemaVersion: number
  name: string
  version: string
  fingerprint: string
  generatedAt: string
  catalog: string
  glossary: string
  totals: { laws: number; catalog: number; articles: number; bytes: number }
  chunks: { file: string; hash: string; bytes: number; articles: number; laws: string[] }[]
  patches: { from: string; to: string; level: string; file: string; bytes: number; ops: number }[]
}

/** قالب فشرده ماده در فایل‌های chunk/patch */
export interface CompactArticle {
  i: string
  k: string
  n: number
  s?: string
  l: string
  h?: string
  t: string
  no?: string[]
  am?: { k: string; d?: string; r: string }[]
  st: ArticleStatus
  r?: string[]
  kw?: string[]
}

export interface Bookmark {
  id?: number
  articleId: string
  createdAt: number
  color?: string
}

export interface Note {
  id?: number
  articleId: string
  text: string
  createdAt: number
  updatedAt: number
}

export interface HistoryItem {
  id?: number
  query: string
  timestamp: number
}

export interface ViewItem {
  articleId: string
  viewedAt: number
}

export interface AmendmentRecord {
  id?: number
  articleId: string
  date: string
  kind: string
  raw: string
}

export interface MetaRecord<T = unknown> {
  key: string
  value: T
}

export interface DatasetMeta {
  version: string
  fingerprint: string
  chunks: string[] // hashهای وارد‌شده
  catalogFile: string
  glossaryFile: string
  installedAt: number
  updatedAt: number
  articleCount: number
  complete: boolean
}

export interface SearchFilters {
  categories?: CategoryId[]
  docGroups?: DocGroup[]
  statuses?: ArticleStatus[]
  lawIds?: string[]
  yearFrom?: number
  yearTo?: number
}

export interface SearchHit {
  id: string
  lawId: string
  lawTitle: string
  label: string
  key: string
  score: number
  exact?: boolean
  status: ArticleStatus
  snippet: string
  terms: string[]
  chapter?: string
}

export interface SearchResponse {
  query: string
  hits: SearchHit[]
  total: number
  tookMs: number
  kind: 'keyword' | 'article' | 'phrase' | 'empty'
  parsed?: { number?: number; suffix?: string; lawId?: string; lawTitle?: string; unit?: string; redirectedFrom?: { lawId: string; number: number } }
  expandedWith?: string[]
}
