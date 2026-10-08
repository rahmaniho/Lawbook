#!/usr/bin/env node
/**
 * دریافت منابع حجیمی که در مخزن گیت نگه‌داری نمی‌شوند.
 *
 * در حال حاضر فقط یک منبع: مخزن پژوهشی HamedJahantigh-git/legal_chatbot (MIT)
 * که مجموعهٔ آراء قضایی (resource/case/case.csv) از آن گرفته می‌شود.
 * این فایل حدود ۱۶ مگابایت است و در گیت ثبت نمی‌شود تا حجم مخزن بالا نرود؛
 * در عوض این اسکریپت آن را مستقیماً از codeload.github.com می‌گیرد.
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
const DEST = path.join(ROOT, 'data', 'sources', 'legalchatbot');
const TARBALL = 'https://codeload.github.com/HamedJahantigh-git/legal_chatbot/tar.gz/refs/heads/master';

/** فایل‌های موردنیاز: مسیر درون بسته → نام فایل مقصد */
const NEEDED = [{ from: 'legal_chatbot-master/resource/case/case.csv', to: 'case.csv' }];

const force = process.argv.includes('--force');

function missing() {
  return NEEDED.filter(({ to }) => force || !fs.existsSync(path.join(DEST, to)));
}

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

async function main() {
  const todo = missing();
  if (!todo.length) {
    console.log('\n📦 منابع از قبل کامل هستند (برای دریافت دوباره: --force)\n');
    return;
  }
  fs.mkdirSync(DEST, { recursive: true });

  console.log(`\n📥 دریافت بستهٔ منبع از codeload.github.com…`);
  const tmp = path.join(DEST, `.source-${Date.now()}.tar.gz`);
  await download(TARBALL, tmp);
  const size = fs.statSync(tmp).size;
  console.log(`   حجم بسته: ${(size / 1024 / 1024).toFixed(1)} مگابایت`);

  try {
    for (const { from, to } of todo) {
      const data = execFileSync('tar', ['-xzf', tmp, '-O', from], {
        maxBuffer: 1 << 30,
        encoding: 'buffer',
      });
      fs.writeFileSync(path.join(DEST, to), data);
      console.log(`   ✓ ${to} (${(data.byteLength / 1024 / 1024).toFixed(1)} مگابایت)`);
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  console.log('\n   ✅ منابع آماده است. اکنون `npm run data:build` را اجرا کنید.\n');
}

main().catch((err) => {
  console.error(`\n   ❌ ${err.message}\n`);
  process.exit(1);
});
