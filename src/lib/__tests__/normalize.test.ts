import { describe, expect, it } from 'vitest'
import { buildHighlightRegex, normalizeDisplay, normalizeSearch, processTerm, toFaDigits, toLatinDigits, tokenize } from '../normalize'

describe('normalizeDisplay', () => {
  it('ي/ك عربی را به ی/ک فارسی تبدیل می‌کند', () => {
    expect(normalizeDisplay('قانون مدني كشور')).toBe('قانون مدنی کشور')
  })
  it('ارقام فارسی و عربی را لاتین می‌کند', () => {
    expect(normalizeDisplay('ماده ۱۰ و ٢٣')).toBe('ماده 10 و 23')
  })
  it('نیم‌فاصله‌های اضافه را اصلاح می‌کند', () => {
    expect(normalizeDisplay('نهضت\u200c های ایران')).toBe('نهضت\u200cهای ایران')
    expect(normalizeDisplay('پایه\u200c\u200c های')).toBe('پایه\u200cهای')
    expect(normalizeDisplay('ماده \u200c425')).toBe('ماده 425')
    expect(normalizeDisplay('\u200cدر مورد')).toBe('در مورد')
    expect(normalizeDisplay('کلمه \u200c\u200c (شرکت)')).toBe('کلمه (شرکت)')
  })
  it('کشیده و Presentation Form را حذف/استاندارد می‌کند', () => {
    expect(normalizeDisplay('قـــانون')).toBe('قانون')
    expect(normalizeDisplay('ﻣﺼﻮﺑﺎت')).toBe('مصوبات')
  })
  it('LRM میان دو حرف را به نیم‌فاصله تبدیل می‌کند', () => {
    expect(normalizeDisplay('رایانه\u200eای')).toBe('رایانه\u200cای')
  })
})

describe('normalizeSearch و توکن‌سازی', () => {
  it('اعراب و همزه‌ها را یکسان می‌کند', () => {
    expect(normalizeSearch('مَهریّة')).toBe('مهریه')
    expect(normalizeSearch('أصل إبطال آیین')).toBe('اصل ابطال ایین')
  })
  it('واژه دارای نیم‌فاصله را چسبیده و جدا ایندکس می‌کند', () => {
    expect(processTerm('قراردادها\u200cی')).toEqual(['قراردادهای', 'قراردادها'])
    expect(processTerm('و')).toBeNull()
  })
  it('توکن‌ها را با علائم فارسی جدا می‌کند', () => {
    expect(tokenize('«ماده ۱۰»، قانون؛ مدنی')).toEqual(['ماده', '10', 'قانون', 'مدنی'])
  })
})

describe('هایلایت منعطف', () => {
  it('گونه‌های املایی را پیدا می‌کند', () => {
    const re = buildHighlightRegex(['مهریه'])!
    expect('پرداخت مَهريه زن'.match(re)?.[0]).toBe('مَهريه')
  })
  it('ارقام فارسی را با ارقام لاتین تطبیق می‌دهد', () => {
    const re = buildHighlightRegex(['1370'])!
    expect('اصلاحی ۱۳۷۰/۸/۱۴'.match(re)?.[0]).toBe('۱۳۷۰')
  })
})

describe('ارقام', () => {
  it('تبدیل دوطرفه', () => {
    expect(toFaDigits('ماده 10')).toBe('ماده ۱۰')
    expect(toLatinDigits('۱۴۰۵/۰۷/۱۱')).toBe('1405/07/11')
  })
})
