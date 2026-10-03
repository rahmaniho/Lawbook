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
const first = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]))]
let raw = 0, gz = 0, bro = 0
for (const f of first) {
  const b = readFileSync(join(DIST, f))
  raw += b.length
  gz += gzipSync(b, { level: 9 }).length
  bro += br(b).length
}
console.log(`بار اول (JS+CSS، ${first.length} فایل): خام ${kb(raw)} | gzip ${kb(gz)} | brotli ${kb(bro)}`)
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
let draw = 0, dgz = 0, dbr = 0
for (const p of walk(join(DIST, 'data')).filter((p) => p.endsWith('.json'))) {
  const b = readFileSync(p)
  draw += b.length
  dgz += gzipSync(b, { level: 9 }).length
  dbr += br(b).length
}
console.log(`داده قوانین (JSON): خام ${kb(draw)} | gzip ${kb(dgz)} | brotli ${kb(dbr)}`)

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
