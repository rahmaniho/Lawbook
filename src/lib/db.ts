import Dexie, { type EntityTable } from 'dexie'
import type { AmendmentRecord, Article, Bookmark, HistoryItem, Law, MetaRecord, Note, ViewItem } from './types'

export interface SearchIndexRecord {
  key: string
  version: string
  json: string
  createdAt: number
}

/**
 * پایگاه داده محلی «GhanounDB» (IndexedDB از طریق Dexie)
 *
 * تفاوت‌های آگاهانه با طرح اولیه مشخصات:
 * - شناسه قوانین و مواد رشته‌ای و پایدار است («civil-code:10») تا نشان‌ها و یادداشت‌ها پس از
 *   به‌روزرسانی داده‌ها معتبر بمانند (به‌جای ++id).
 * - فیلد text ایندکس نمی‌شود (ایندکس IndexedDB روی متن‌های بلند پرهزینه است)؛ جستجوی تمام‌متن
 *   با MiniSearch در Web Worker انجام و ایندکس سریالایز‌شده در جدول searchIndex نگه داشته می‌شود.
 * - یادداشت‌ها در جدول جداگانه notes نگهداری می‌شوند و views برای «اخیراً دیده‌شده» است.
 */
export class GhanounDB extends Dexie {
  laws!: EntityTable<Law, 'id'>
  articles!: EntityTable<Article, 'id'>
  bookmarks!: EntityTable<Bookmark, 'id'>
  notes!: EntityTable<Note, 'id'>
  history!: EntityTable<HistoryItem, 'id'>
  views!: EntityTable<ViewItem, 'articleId'>
  amendments!: EntityTable<AmendmentRecord, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>
  searchIndex!: EntityTable<SearchIndexRecord, 'key'>

  constructor(name = 'GhanounDB') {
    super(name)
    this.version(1).stores({
      laws: 'id, title, category, hierarchy, status, docType',
      articles: 'id, lawId, [lawId+order], articleNumber, *keywords, status',
      bookmarks: '++id, &articleId, createdAt',
      notes: '++id, &articleId, updatedAt',
      history: '++id, query, timestamp',
      views: '&articleId, viewedAt',
      amendments: '++id, articleId, date',
      meta: '&key',
      searchIndex: '&key',
    })
  }
}

export const db = new GhanounDB()

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const r = await db.meta.get(key)
  return r?.value as T | undefined
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await db.meta.put({ key, value })
}
