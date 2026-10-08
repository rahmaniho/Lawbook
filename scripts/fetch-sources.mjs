#!/usr/bin/env node
/**
 * دریافت منابعی که در مخزن گیت نگه‌داری نمی‌شوند (یا حجیم‌اند).
 *
 * منابع فعلی:
 *  ۱. مخزن پژوهشی HamedJahantigh-git/legal_chatbot (MIT)
 *     → مجموعهٔ آراء قضایی (حدود ۱۶ مگابایت؛ در گیت ثبت نمی‌شود)
 *  ۲. مخزن GeekNeuron/IranLegalHUB (MIT برای ساختار و آرایه‌گذاری)
 *     → متون ساخت‌یافته‌ای که هنوز وارد برنامه نشده‌اند
 *
 * دریافت از codeload.github.com انجام می‌شود (بدون نیاز به raw.githubusercontent.com).
 *
 *   node scripts/fetch-sources.mjs            # فقط فایل‌های ناقص را می‌گیرد
 *   node scripts/fetch-sources.mjs --force    # دریافت دوبارهٔ همه‌چیز
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCES_DIR = path.join(ROOT, 'data', 'sources');

/** @type {{name:string, tarball:string, dest:string, files:{from:string,to:string}[]}[]} */
const SOURCES = [
  {
    name: 'legal_chatbot (MIT)',
    tarball: 'https://codeload.github.com/HamedJahantigh-git/legal_chatbot/tar.gz/refs/heads/master',
    dest: 'legalchatbot',
    files: [{ from: 'legal_chatbot-master/resource/case/case.csv', to: 'case.csv' }],
  },
  {
    name: 'IranLegalHUB (MIT)',
    tarball: 'https://codeload.github.com/GeekNeuron/IranLegalHUB/tar.gz/refs/heads/main',
    dest: 'iranlegalhub',
    files: [
      { from: 'IranLegalHUB-main/laws/batch3/customs_law.json', to: 'laws_batch3_customs_law.json' },
      { from: 'IranLegalHUB-main/laws/batch3/hosbi_law.json', to: 'laws_batch3_hosbi_law.json' },
      { from: 'IranLegalHUB-main/laws/batch3/military_service_law.json', to: 'laws_batch3_military_service_law.json' },
      {
        from: 'IranLegalHUB-main/laws/batch3/military_service_addendum_law.json',
        to: 'laws_batch3_military_service_addendum_law.json',
      },
      {
        from: 'IranLegalHUB-main/laws/batch3/bribery_embezzlement_law.json',
        to: 'laws_batch3_bribery_embezzlement_law.json',
      },
      { from: 'IranLegalHUB-main/laws/batch3/prison_reduction_law.json', to: 'laws_batch3_prison_reduction_law.json' },
    ],
  },
];

const force = process.argv.includes('--force');

/**
 * دریافت فایل. ابتدا با fetch داخلی Node امتحان می‌شود و در صورت خطا
 * (مثلاً گواهی‌نامهٔ شرکتی یا Proxy)، از curl استفاده می‌شود.
 */
async function download(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return;
  } catch (err) {
    try {
      execFileSync('curl', ['-sSL', '--fail', '--max-time', '600', '-o', dest, url], {
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    } catch {
      throw new Error(`دریافت ناموفق بود: ${err.message} (و curl هم در دسترس/موفق نبود)`);
    }
  }
}

async function fetchSource(source) {
  const dest = path.join(SOURCES_DIR, source.dest);
  const todo = source.files.filter(({ to }) => force || !fs.existsSync(path.join(dest, to)));
  if (!todo.length) {
    console.log(`\n📦 ${source.name}: از قبل کامل است`);
    return 0;
  }

  const tmp = path.join(SOURCES_DIR, `.tmp-${source.dest}.tgz`);
  fs.mkdirSync(dest, { recursive: true });
  await download(source.tarball, tmp);
  console.log(`\n📦 ${source.name}: حجم بسته ${(fs.statSync(tmp).size / 1024 / 1024).toFixed(1)} مگابایت`);

  for (const { from, to } of todo) {
    const out = path.join(dest, to);
    execFileSync('tar', ['-xzf', tmp, '-O', from], {
      maxBuffer: 1 << 30,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const buf = execFileSync('tar', ['-xzf', tmp, '-O', from], { maxBuffer: 1 << 30, encoding: 'buffer' });
    fs.writeFileSync(out, buf);
    console.log(`   ✓ ${to} (${(buf.length / 1024).toFixed(0)} کیلوبایت)`);
  }
  fs.rmSync(tmp, { force: true });
  return todo.length;
}

async function main() {
  console.log('\n⬇️  دریافت منابع داده\n');
  let total = 0;
  for (const source of SOURCES) {
    try {
      total += await fetchSource(source);
    } catch (err) {
      console.error(`   ❌ ${source.name}: ${err.message}`);
    }
  }
  console.log(total ? `\n   ✅ ${total} فایل دریافت شد.\n` : '\n   همه منابع از قبل کامل هستند (برای دریافت دوباره: --force)\n');
}

main();
