/**
 * گزارش حجم بار اول (JS/CSS مورد نیاز index.html) و داده‌ها به‌صورت خام/gzip/brotli
 * و ساخت نسخه‌های پیش‌فشرده (.br/.gz) برای میزبان‌های ایستا (nginx brotli_static و …)
 *   node scripts/report-size.mjs [--compress]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync, constants } from 'node:zlib'

const DIST = 'dist'
const compress = process.argv.includes('--compress')
const br = (b) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
const kb = (n) => `${(n / 1024).toFixed(1)}KB`

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
// افزونه fastFirstPaint (vite.config.ts) CSS اصلی را درون index.html می‌گذارد و فایل‌های JS بار اول را
// از درون اسکریپت بارگذار درج می‌کند؛ پس هم برچسب‌ها و هم رشته‌های "/assets/…" شمرده می‌شوند.
const first = [...new Set([...html.matchAll(/["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map((m) => m[1]))]
let raw = 0, gz = 0, bro = 0
const add = (b) => {
  raw += b.length
  gz += gzipSync(b, { level: 9 }).length
  bro += br(b).length
}
add(Buffer.from(html, 'utf8'))
for (const f of first) add(readFileSync(join(DIST, f)))
console.log(`بار اول (index.html با CSS درون‌خطی + ${first.length} فایل JS/CSS): خام ${kb(raw)} | gzip ${kb(gz)} | brotli ${kb(bro)}`)
if (gz > 300 * 1024) {
  console.error('✗ حجم بار اول (gzip) از ۳۰۰KB بیشتر است')
  process.exitCode = 1
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const sizes = { law: [0, 0, 0], qindex: [0, 0, 0] }
for (const p of walk(join(DIST, 'data')).filter((p) => p.endsWith('.json'))) {
  const b = readFileSync(p)
  const s = p.includes(`${join('data', 'qindex')}`) ? sizes.qindex : sizes.law
  s[0] += b.length
  s[1] += gzipSync(b, { level: 9 }).length
  s[2] += br(b).length
}
console.log(`داده قوانین (JSON، نصب آفلاین): خام ${kb(sizes.law[0])} | gzip ${kb(sizes.law[1])} | brotli ${kb(sizes.law[2])}`)
if (sizes.qindex[0])
  console.log(`فهرست مصوبات (JSON، دریافت در صورت نیاز): خام ${kb(sizes.qindex[0])} | gzip ${kb(sizes.qindex[1])} | brotli ${kb(sizes.qindex[2])}`)

if (compress) {
  let n = 0
  for (const p of walk(DIST).filter((p) => /\.(js|css|html|json|svg|webmanifest)$/.test(p))) {
    const b = readFileSync(p)
    if (b.length < 1024) continue
    writeFileSync(p + '.br', br(b))
    writeFileSync(p + '.gz', gzipSync(b, { level: 9 }))
    n++
  }
  console.log(`✓ نسخه‌های .br و .gz برای ${n} فایل ساخته شد`)
}
