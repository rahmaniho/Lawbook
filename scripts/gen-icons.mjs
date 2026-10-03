#!/usr/bin/env node
/**
 * تولید آیکون‌های PWA از یک طرح SVG (بدون وابستگی به فایل تصویری خارجی).
 * اجرا: npm run icons:gen
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

/** ترازو (نماد عدالت) روی زمینه سبز برند */
function svg({ size, maskable = false, rounded = true }) {
  const pad = maskable ? size * 0.16 : size * 0.08;
  const scale = (size - pad * 2) / 100;
  const radius = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#115e59"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="50" y1="14" x2="50" y2="86"/>
    <line x1="16" y1="26" x2="84" y2="26"/>
    <line x1="50" y1="86" x2="30" y2="90"/>
    <line x1="50" y1="86" x2="70" y2="90"/>
    <path d="M16 26 L6 50 H26 Z" fill="#ffffff" fill-opacity="0.16"/>
    <path d="M84 26 L74 50 H94 Z" fill="#ffffff" fill-opacity="0.16"/>
    <path d="M8 50 a10 10 0 0 0 20 0"/>
    <path d="M72 50 a10 10 0 0 0 20 0"/>
    <circle cx="50" cy="12" r="5" fill="#ffffff" stroke="none"/>
  </g>
</svg>`;
}

async function render(name, size, opts) {
  const file = path.join(OUT, name);
  await sharp(Buffer.from(svg({ size, ...opts }))).png({ compressionLevel: 9 }).toFile(file);
  console.log(`✓ ${name} (${size}×${size})`);
}

await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('maskable-512.png', 512, { maskable: true });
await render('apple-touch-icon.png', 180, { rounded: false });
await render('favicon-32.png', 32);
await render('maskable-192.png', 192, { maskable: true });

// favicon.ico (نسخه PNG ۳۲ داخل ظرف ICO ساده مرورگرها را راضی می‌کند)
fs.copyFileSync(path.join(OUT, 'favicon-32.png'), path.join(ROOT, 'public', 'favicon.ico'));
console.log('✓ favicon.ico');
