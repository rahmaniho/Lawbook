import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../lib/db'
import { getMeta } from '../lib/db'
import { CATALOG_KEY, CATALOG_LAWS_KEY } from '../lib/data/sync'
import type { CatalogFile, Law } from '../lib/types'

/**
 * همه قوانین کاتالوگ (شامل موارد در انتظار ورود)، مرتب بر اساس اولویت — بدون فهرست مطالب.
 * از رکورد سبک meta خوانده می‌شود تا نوشتن مواد (در Worker) باعث اجرای مجدد کوئری نشود.
 */
export function useLaws(): Law[] | undefined {
  const laws = useLiveQuery(() => getMeta<Law[]>(CATALOG_LAWS_KEY), [])
  return useMemo(() => laws?.slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)), [laws])
}

export function useLaw(id: string | undefined): Law | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.laws.get(id)) ?? null) : null), [id])
}

export function useCatalogMeta() {
  return useLiveQuery(() => getMeta<Pick<CatalogFile, 'hierarchy' | 'categories'> & { file: string }>(CATALOG_KEY), [])
}
