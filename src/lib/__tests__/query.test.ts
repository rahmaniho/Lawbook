import { describe, expect, it } from 'vitest'
import { LawResolver, parseQuery, articleKeyFrom } from '../search/query'

const resolver = new LawResolver([
  { id: 'constitution', title: 'قانون اساسی جمهوری اسلامی ایران', shortTitle: 'قانون اساسی', aliases: ['اساسی', 'ق.ا'], unit: 'اصل', priority: 100 },
  { id: 'civil-code', title: 'قانون مدنی', shortTitle: 'قانون مدنی', aliases: ['مدنی', 'ق.م'], unit: 'ماده', priority: 95 },
  { id: 'penal-code-tazirat', title: 'قانون مجازات اسلامی (کتاب پنجم - تعزیرات)', shortTitle: 'تعزیرات', aliases: ['تعزیرات'], unit: 'ماده', priority: 90 },
  { id: 'labor', title: 'قانون کار', shortTitle: 'قانون کار', aliases: ['کار'], unit: 'ماده', priority: 84 },
])

describe('parseQuery — شماره ماده', () => {
  it('«ماده ۱۰ قانون مدنی»', () => {
    const q = parseQuery('ماده ۱۰ قانون مدنی', resolver)
    expect(q.kind).toBe('article')
    expect(q.article).toMatchObject({ number: 10, lawId: 'civil-code' })
    expect(q.terms).toEqual([])
  })
  it('«اصل ۴۴» به قانون اساسی می‌رسد', () => {
    expect(parseQuery('اصل ۴۴', resolver).article).toMatchObject({ number: 44, lawId: 'constitution', unit: 'اصل' })
  })
  it('اختصار «م ۱۰ ق.م»', () => {
    expect(parseQuery('م ۱۰ ق.م', resolver).article).toMatchObject({ number: 10, lawId: 'civil-code' })
  })
  it('«مدنی ۱۰» و «۱۰ مدنی»', () => {
    expect(parseQuery('مدنی ۱۰', resolver).article?.lawId).toBe('civil-code')
    expect(parseQuery('۱۰ مدنی', resolver).article?.lawId).toBe('civil-code')
  })
  it('«قانون کار ماده ۷»', () => {
    expect(parseQuery('قانون کار ماده ۷', resolver).article).toMatchObject({ number: 7, lawId: 'labor' })
  })
  it('ماده مکرر', () => {
    const q = parseQuery('ماده ۴۹۹ مکرر تعزیرات', resolver)
    expect(q.article).toMatchObject({ number: 499, suffix: 'مکرر', lawId: 'penal-code-tazirat' })
    expect(articleKeyFrom(499, 'مکرر')).toBe('499-bis')
  })
  it('عدد همراه متن غیرقانونی، جستجوی کلیدواژه است', () => {
    expect(parseQuery('3 سال حبس', resolver).kind).toBe('keyword')
  })
  it('ماده بدون نام قانون', () => {
    const q = parseQuery('ماده 10', resolver)
    expect(q.kind).toBe('article')
    expect(q.article?.lawId).toBeUndefined()
  })
})

describe('parseQuery — عبارت و کلیدواژه', () => {
  it('عبارت داخل گیومه', () => {
    const q = parseQuery('«عسر و حرج»', resolver)
    expect(q.kind).toBe('phrase')
    expect(q.phrase).toBe('عسر و حرج')
  })
  it('کلیدواژه با حروف عربی', () => {
    const q = parseQuery('مهريه', resolver)
    expect(q.kind).toBe('keyword')
    expect(q.terms).toEqual(['مهریه'])
  })
})
