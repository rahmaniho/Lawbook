'use client';

/**
 * موتور جست‌وجوی چندلایه:
 *  - لایه ۱: کارگر (Web Worker) با ایندکس MiniSearch
 *  - لایه ۲: پشتیبان روی رشته اصلی در صورت عدم پشتیبانی مرورگر
 *  - لایه ۳: تحلیل ساختاری «ماده ۱۰ قانون مدنی» و فیلترها
 */
import MiniSearch from 'minisearch';
import { normalizeForSearch, parseQuery, tokenize } from './fa';
import type { ArticleRow } from './db';

export interface SearchFilters {
  category?: string | null;
  lawId?: string | null;
  hierarchy?: string | null;
  status?: string | null;
}

export interface SearchResultItem {
  article: ArticleRow;
  score: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  elapsed: number;
  total: number;
}

let worker: Worker | null = null;
let workerReady: Promise<boolean> | null = null;
let messageId = 0;
const pending = new Map<number, (value: SearchResponse) => void>();

/** ایندکس پشتیبان (رشته اصلی) */
let localIndex: MiniSearch<ArticleRow> | null = null;
const localById = new Map<string, ArticleRow>();

function buildLocalIndex(articles: ArticleRow[]) {
  localIndex = new MiniSearch<ArticleRow>({
    idField: 'id',
    fields: ['textNorm', 'titleNorm', 'keywordNorm'],
    storeFields: ['id'],
    tokenize: (text: string) => tokenize(text),
    processTerm: (term: string) => (term.length > 1 ? term : null),
    searchOptions: { boost: { titleNorm: 2.2, keywordNorm: 1.6, textNorm: 1 }, fuzzy: 0.2, prefix: true },
  });
  const docs = articles.map((a) => {
    localById.set(a.id, a);
    return {
      ...a,
      textNorm: normalizeForSearch(a.text),
      titleNorm: normalizeForSearch(`${a.lawTitle} ${a.numberFa} ${a.chapter ?? ''}`),
      keywordNorm: normalizeForSearch((a.keywords || []).join(' ')),
    };
  });
  localIndex.addAll(docs as never[]);
}

export function initSearchEngine(articles: ArticleRow[]): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (workerReady) return workerReady;

  workerReady = new Promise<boolean>((resolve) => {
    try {
      worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url));
      worker.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as
          | { type: 'ready'; count: number }
          | { type: 'results'; id: number; results: SearchResultItem[]; elapsed: number; total: number };
        if (data.type === 'ready') {
          resolve(true);
          return;
        }
        if (data.type === 'results') {
          const cb = pending.get(data.id);
          if (cb) {
            cb({ results: data.results, elapsed: data.elapsed, total: data.total });
            pending.delete(data.id);
          }
        }
      });
      worker.addEventListener('error', () => {
        worker = null;
        buildLocalIndex(articles);
        resolve(false);
      });
      worker.postMessage({ type: 'init', articles });
    } catch {
      buildLocalIndex(articles);
      resolve(false);
    }
  });

  return workerReady;
}

function localSearch(q: string, filters: SearchFilters | undefined, limit: number): SearchResponse {
  const started = performance.now();
  if (!localIndex) return { results: [], elapsed: 0, total: 0 };
  const parsed = parseQuery(q);
  const normQ = normalizeForSearch(q);
  const scored = new Map<string, number>();

  if (parsed.article !== null && parsed.terms.length === 0) {
    const lawHint = normalizeForSearch(parsed.lawHint);
    for (const a of localById.values()) {
      if (a.numberValue !== parsed.article) continue;
      if (lawHint.length > 2 && !normalizeForSearch(`${a.lawTitle} ${a.lawId}`).includes(lawHint)) continue;
      scored.set(a.id, 100);
    }
  }

  if (normQ.length > 1) {
    let hits = (localIndex.search(normQ, { combineWith: 'AND' }) as unknown as { id: string; score: number }[]).slice(0, 200);
    if (!hits.length) {
      hits = (localIndex.search(normQ, { combineWith: 'OR' }) as unknown as { id: string; score: number }[]).slice(0, 200);
    }
    for (const h of hits) scored.set(h.id, (scored.get(h.id) ?? 0) + h.score);
  }

  const results: SearchResultItem[] = [];
  for (const [id, score] of [...scored.entries()].sort((a, b) => b[1] - a[1])) {
    const a = localById.get(id);
    if (!a) continue;
    if (filters?.category && a.category !== filters.category) continue;
    if (filters?.lawId && a.lawId !== filters.lawId) continue;
    if (filters?.hierarchy && a.hierarchy !== filters.hierarchy) continue;
    if (filters?.status && a.status !== filters.status) continue;
    results.push({ article: a, score });
    if (results.length >= limit) break;
  }
  return { results, elapsed: performance.now() - started, total: results.length };
}

export async function runSearch(
  articles: ArticleRow[],
  q: string,
  filters?: SearchFilters,
  limit = 40,
): Promise<SearchResponse> {
  if (!q.trim()) return { results: [], elapsed: 0, total: 0 };
  const ready = await initSearchEngine(articles);
  if (worker && ready) {
    const id = ++messageId;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker!.postMessage({ type: 'query', id, q, filters, limit });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve(localSearch(q, filters, limit));
        }
      }, 4000);
    });
  }
  return localSearch(q, filters, limit);
}
