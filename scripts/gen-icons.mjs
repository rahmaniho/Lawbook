/**
 * تولید آیکن‌های PWA از SVG منبع (public/icons/icon.svg)
 * خروجی: 192.png، 512.png، maskable.png (۵۱۲ با ناحیه امن)، apple-touch-icon.png (۱۸۰)، favicon-32.png
 */
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const book = (scale = 1, offset = 0) => `
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M256 170c-40-27-90-35-142-31v222c52-4 102 4 142 31z" fill="#ffffff"/>
    <path d="M256 170c40-27 90-35 142-31v222c-52-4-102 4-142 31z" fill="#d7f5ef"/>
    <path d="M256 170v222" stroke="#0b5e57" stroke-width="7" stroke-linecap="round"/>
    <path d="M334 132v92l22-17 22 17v-94z" fill="#f59e0b"/>
    <g stroke="#0f766e" stroke-opacity=".38" stroke-width="11" stroke-linecap="round">
      <path d="M150 206h72M150 243h72M150 280h72M150 317h52"/>
      <path d="M290 243h72M290 280h72M290 317h52"/>
    </g>
  </g>`

const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16a394"/><stop offset="1" stop-color="#0b5e57"/></linearGradient></defs>`

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" rx="116" fill="url(#g)"/>${book()}</svg>`
// نسخه maskable: پس‌زمینه تمام‌صفحه و محتوا در ناحیه امن ۸۰٪ مرکزی
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#g)"/>${book(0.78, 56)}</svg>`
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#g)"/>${book(0.86, 36)}</svg>`

writeFileSync('public/icons/icon.svg', iconSvg)
const out = [
  [iconSvg, 192, 'public/icons/192.png'],
  [iconSvg, 512, 'public/icons/512.png'],
  [maskableSvg, 512, 'public/icons/maskable.png'],
  [appleSvg, 180, 'public/icons/apple-touch-icon.png'],
  [iconSvg, 32, 'public/icons/favicon-32.png'],
]
for (const [svg, size, file] of out) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
  console.log('✓', file)
}
