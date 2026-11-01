/** Produce a two-directory cPanel distribution. Never put private/ inside webroot. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const result = spawnSync('npm', ['run', 'build'], {
  cwd: root, stdio: 'inherit',
  env: { ...process.env, VERCEL: '0', NEXT_PUBLIC_BASE_PATH: '/app', NEXT_PUBLIC_LICENSED_DEPLOYMENT: '1' },
});
if (result.status !== 0) process.exit(result.status ?? 1);
const target = path.join(root, 'build/cpanel');
fs.rmSync(target, { recursive: true, force: true });
const privateDir = path.join(target, 'lawbook-private');
const publicDir = path.join(target, 'public_html');
fs.mkdirSync(privateDir, { recursive: true });
fs.cpSync(path.join(root, 'deploy/cpanel/public'), publicDir, { recursive: true });
fs.cpSync(path.join(root, 'deploy/cpanel/private'), privateDir, { recursive: true });
fs.cpSync(path.join(root, 'out'), path.join(privateDir, 'app'), { recursive: true });
// A service worker must never allow access to paid resources offline.
fs.rmSync(path.join(privateDir, 'app/sw.js'), { force: true });
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const contracts = read('data/contracts/contracts.json');
const education = read('data/contracts/education.json');
const previews = contracts.topics.map((topic) => ({
  title: topic.title,
  items: contracts.contracts.filter((c) => c.topic === topic.id).slice(0, 1).map((c) => ({
    title: `${c.title} — گزیده آموزشی رایگان`,
    text: `${c.summary}\n${c.clauses[4].title}\n${c.clauses[4].text}\n${education.disclaimer}`,
  })),
}));
previews.push({ title: 'آموزش قرارداد‌نویسی', items: education.lessons.slice(0, 2).map((l) => ({title:l.title,text:l.sections.map((s)=>`${s.title}: ${s.text}`).join('\n')})) });
const pointer = read('public/data/version.json');
const samples = [];
const seen = new Set();
for (const law of pointer.laws) {
  if (seen.has(law.hierarchy)) continue;
  seen.add(law.hierarchy);
  const part = read(`public${law.parts[0].path}`);
  const article = (Array.isArray(part) ? part : part.articles ?? [])[0];
  if (article) samples.push({ title: `${law.title} — گزیده رایگان`, text: `${article.text.slice(0, 1000)}\nاین گزیده جای متن کامل و بررسی اصلاحات را نمی‌گیرد.` });
}
previews.push({ title: 'قوانین، موازین شرع و آرای منتخب', items: samples });
previews.push({ title: 'آزمون و تمرین', items: [{title:'تمرین رایگان تنظیم تعهد',text:'کدام عبارت دقیق‌تر است؟ الف: کار به‌خوبی انجام شود. ب: پنج صفحه با معیار آزمون مشخص تحویل شود. پاسخ: ب؛ موضوع و شاخص تحویل روشن‌تر است.'}] });
previews.push({ title: 'محاسبات آموزشی', items: [{title:'تقسیم اصل بدهی به اقساط مساوی',text:'برای اصل بدهی فرضی ۱۰۰٬۰۰۰٬۰۰۰ ریال در پنج قسط برابر و بدون بهره، هر قسط ۲۰٬۰۰۰٬۰۰۰ ریال است. این صرفاً تمرین حساب است، نه نرخ قانونی یا مشاوره مالی.'}] });
fs.writeFileSync(path.join(privateDir, 'previews.json'), JSON.stringify(previews, null, 2));
fs.copyFileSync(path.join(root, 'docs/cpanel-subscriptions.md'), path.join(target, 'INSTALL.md'));
console.log('cPanel package: build/cpanel/ — ONLY public_html files belong in the web root.');
