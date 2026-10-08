/**
 * ابزارهای کار با فهرست نهادها (فهرست مرجع).
 * این فهرست از کاتالوگ خوانده می‌شود و جست‌وجوی آن روی همان دستگاه انجام می‌گیرد.
 */
import { normalizeForSearch } from './fa';
import type { Catalog, Entity, EntityGroup, LawMeta } from './types';

export function allEntities(catalog: Catalog | null): Entity[] {
  if (!catalog?.entityGroups?.length) return [];
  return catalog.entityGroups.flatMap((g) => g.items);
}

export function entityGroup(catalog: Catalog | null, groupId: string): EntityGroup | undefined {
  return catalog?.entityGroups?.find((g) => g.id === groupId);
}

export interface EntityMatch {
  entity: Entity;
  group?: EntityGroup;
}

/** آیا این سند فقط شناسنامه دارد (متن ماده‌ها در برنامه موجود نیست)؟ */
export function isReferenceLaw(law: Pick<LawMeta, 'articleCount' | 'source'>): boolean {
  return !law.articleCount || law.source?.kind === 'reference';
}

/**
 * اسناد «فقط‌شناسنامه» منطبق با عبارت جست‌وجو.
 * این اسناد ماده‌ای ندارند و در ایندکس متن جست‌وجو نیستند؛
 * بنابراین جداگانه روی عنوان، خلاصه و کلیدواژه‌ها تطبیق داده می‌شوند.
 */
export function matchReferenceLaws(catalog: Catalog | null, query: string, limit = 6): LawMeta[] {
  const q = normalizeForSearch(query.trim());
  if (q.length < 2 || !catalog?.laws?.length) return [];
  const out: LawMeta[] = [];
  for (const law of catalog.laws) {
    if (!isReferenceLaw(law)) continue;
    const hay = normalizeForSearch(
      `${law.title} ${law.shortTitle} ${law.summary} ${(law.keywords || []).join(' ')}`,
    );
    if (!hay.includes(q)) continue;
    out.push(law);
    if (out.length >= limit) break;
  }
  return out;
}

/** تطبیق ساده و سریع روی عنوان، عنوان کوتاه، مخفف و یادداشت نهاد */
export function matchEntities(catalog: Catalog | null, query: string, limit = 8): EntityMatch[] {
  const q = normalizeForSearch(query.trim());
  if (q.length < 2 || !catalog?.entityGroups?.length) return [];
  const groups = catalog.entityGroups;
  const out: EntityMatch[] = [];
  for (const group of groups) {
    for (const entity of group.items) {
      const hay = normalizeForSearch(`${entity.title} ${entity.shortTitle} ${entity.abbr} ${entity.note}`);
      if (!hay.includes(q)) continue;
      out.push({ entity, group });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
