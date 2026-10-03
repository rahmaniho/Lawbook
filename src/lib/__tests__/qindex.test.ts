import { describe, expect, it } from 'vitest'
import { classifyEntry, matchKey, matchTokens, qavaninUrl, yearOf, type QIndexChunk } from '../qindex/model'
import { QIndexEngine } from '../qindex/engine'

describe('طبقه‌بندی مصوبات فهرست', () => {
  it('بر اساس مرجع تصویب و عنوان', () => {
    expect(classifyEntry('قانون مدنی', 'مجلس شورای ملی')).toBe('statute')
    expect(classifyEntry('قانون مالیات بر ارزش افزوده', 'مجلس شوراي اسلامي')).toBe('statute')
    expect(classifyEntry('لایحه قانونی ایجاد سپاه دانش', 'همه پرسي')).toBe('statute')
    expect(classifyEntry('قانون آیین دادرسی کیفری', 'کمیسیون امور قضایی و حقوقی مجلس')).toBe('statute')
    expect(classifyEntry('قانون اساسی جمهوری اسلامی ایران', 'همه پرسی')).toBe('constitution')
    expect(classifyEntry('متمم قانون اساسی', 'پادشاه وقت')).toBe('constitution')
    expect(classifyEntry('نظر تفسیری شورای نگهبان در خصوص اصل 73 قانون اساسی', 'شورای نگهبان')).toBe('constitution')
    expect(classifyEntry('تصویب نامه راجع به تعیین نصاب معاملات', 'هيات وزيران')).toBe('regulation')
    expect(classifyEntry('اصلاح ماده (3) آیین نامه', 'رییس قوه قضاییه')).toBe('regulation')
    expect(classifyEntry('رأي وحدت رويه شماره 718 ديوان عالي كشور در خصوص حق حبس مهريه', 'دیوان عالی کشور')).toBe('precedent')
    expect(classifyEntry('ابطال بند 5 بخشنامه شماره 1800', 'دیوان عدالت اداری')).toBe('precedent')
    expect(classifyEntry('نظر مشورتي 7/99/167 اداره كل حقوقي قوه قضاييه', 'اداره کل حقوقی قوه قضائیه')).toBe('advisory')
    expect(classifyEntry('تصویب نامه شورای شهر اصفهان در خصوص …', 'شورای اسلامی شهر اصفهان')).toBe('local')
    expect(classifyEntry('سیاست های کلی برنامه پنجم توسعه', 'مقام معظم رهبری')).toBe('other')
    expect(classifyEntry('نظریه رییس مجلس شورای اسلامی موضوع …', 'رییس مجلس')).toBe('other')
    // «لوایح قانونی» دولت مصدق در حکم قانون‌اند؛ سایر مصوبات همان مرجع مقررات
    expect(classifyEntry('لایحه قانونی اصلاح قانون استخدام کشوری', 'نخست وزیر (مصدق)')).toBe('statute')
    expect(classifyEntry('تصویب‌نامه درباره …', 'نخست وزیر (مصدق)')).toBe('regulation')
  })
})

describe('تطبیق متن فهرست', () => {
  it('گونه‌های نیم‌فاصله/فاصله و حروف عربی یکسان می‌شوند', () => {
    const k = matchKey('قانون ماليات‌هاي مستقيم')
    expect(k).toBe(matchKey('قانون مالیات های مستقیم'))
    expect(k).toBe(matchKey('قانون مالیاتهای مستقیم'))
    expect(k.includes(' ')).toBe(false)
  })
  it('توکن‌ها: طولانی‌ترین اول، بدون نیم‌فاصله و تکرار', () => {
    expect(matchTokens('مالیات‌های  مستقیم مالیات‌های')).toEqual(['مالیاتهای', 'مستقیم'])
    expect(matchTokens('  ')).toEqual([])
    expect(matchTokens('ماده ۱۰')).toEqual(['ماده', '10'])
  })
  it('سال تصویب و پیوند رسمی', () => {
    expect(yearOf('1373/07/24')).toBe(1373)
    expect(yearOf('1131/10/12')).toBe(0)
    expect(yearOf('')).toBe(0)
    expect(qavaninUrl(178971)).toBe('https://qavanin.ir/Law/TreeText/178971')
  })
})

const chunks: QIndexChunk[] = [
  {
    type: 'statute',
    ids: [3, 2, 1],
    titles: ['قانون مالیات‌های مستقیم', 'قانون مدنی', 'قانون تجارت'],
    dates: ['1366/12/03', '1314/08/08', '1311/02/13'],
    auth: [1, 2, 2],
  },
  {
    type: 'regulation',
    ids: [10, 11],
    titles: ['آیین‌نامه اجرایی قانون مالیات های مستقیم', 'تصویب‌نامه درباره نصاب معاملات'],
    dates: ['1381/05/01', '1383/03/06'],
    auth: [0, 0],
  },
]
const authorities = ['هیات وزیران', 'مجلس شورای اسلامی', 'مجلس شورای ملی']

describe('موتور جستجوی فهرست مصوبات', () => {
  const engine = new QIndexEngine(chunks, authorities, { '2': 'civil-code' })

  it('جستجوی کلیدواژه با تحمل نیم‌فاصله و رتبه‌بندی (قانون پیش از آیین‌نامه)', () => {
    const r = engine.search({ q: 'مالیاتهای مستقیم' })
    expect(r.total).toBe(2)
    expect(r.items[0].id).toBe(3)
    expect(r.items[0].type).toBe('statute')
    expect(r.byType).toEqual({ statute: 1, regulation: 1 })
  })

  it('فیلتر نوع، مرجع و سال', () => {
    expect(engine.search({ q: 'مالیات', types: ['regulation'] }).items.map((i) => i.id)).toEqual([10])
    expect(engine.search({ authority: 'مجلس شورای ملی' }).items.map((i) => i.id)).toEqual([2, 1])
    expect(engine.search({ yearFrom: 1380 }).items.map((i) => i.id)).toEqual([11, 10])
    expect(engine.search({ authority: 'مرجع ناموجود' }).total).toBe(0)
  })

  it('مرور بدون پرس‌وجو: جدیدترین/قدیمی‌ترین و صفحه‌بندی', () => {
    expect(engine.search({}).items.map((i) => i.id)).toEqual([11, 10, 3, 2, 1])
    expect(engine.search({ sort: 'oldest', limit: 2 }).items.map((i) => i.id)).toEqual([1, 2])
    expect(engine.search({ sort: 'oldest', offset: 2, limit: 2 }).items.map((i) => i.id)).toEqual([3, 10])
  })

  it('پیوند به متن کامل در اپ و دریافت با شناسه', () => {
    expect(engine.get(2)).toMatchObject({ title: 'قانون مدنی', lawId: 'civil-code', authority: 'مجلس شورای ملی' })
    expect(engine.get(999)).toBeNull()
    expect(engine.count).toBe(5)
  })

  it('تطبیق از مرز دو عنوان عبور نمی‌کند', () => {
    // «تجارت» در انتهای یک عنوان و «آیین» در ابتدای عنوان بعدی است
    expect(engine.search({ q: 'تجارتآیین' }).total).toBe(0)
  })
})
