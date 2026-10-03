import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CREDITS } from '../credits'

const root = new URL('../../../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), 'utf8')

describe('اعتبار و منبع (اسپلش، فوتر، درباره ما، manifest)', () => {
  it('صفحه اسپلش index.html متن اعتبار را دارد', () => {
    const html = read('index.html')
    expect(html).toContain('id="splash"')
    expect(html).toContain(CREDITS.compiler.role)
    expect(html).toContain(CREDITS.compiler.name)
    expect(html).toContain(CREDITS.developer.role)
    expect(html).toContain(`${CREDITS.developer.name} — `)
    expect(html).toContain(CREDITS.developer.url)
  })
  it('فوتر و صفحه درباره ما از منبع واحد CREDITS استفاده می‌کنند', () => {
    expect(read('src/components/layout/AppFooter.tsx')).toContain('CREDITS.compiler.name')
    expect(read('src/RootLayout.tsx')).toContain('<AppFooter')
    const about = read('src/pages/AboutPage.tsx')
    expect(about).toContain('CREDITS.statement')
    expect(about).toContain('CREDITS.developer.url')
  })
  it('manifest و package.json سازندگان را معرفی می‌کنند', () => {
    const vite = read('vite.config.ts')
    expect(vite).toContain(CREDITS.compiler.name)
    expect(vite).toContain(CREDITS.developer.host)
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.author.url).toBe(CREDITS.developer.url)
  })
  it('عبارت اعتبار مطابق مشخصات پروژه است', () => {
    expect(CREDITS.compiler.name).toBe('وکیل پایه یک دادگستری لیلا آبکه')
    expect(CREDITS.developer.name).toBe('کارن سافت')
    expect(CREDITS.developer.url).toBe('https://karen-soft.ir')
  })
})
