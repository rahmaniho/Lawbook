import { Link } from 'react-router'
import { Calculator, ChevronLeft, Coins, QrCode } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { Disclaimer } from '../components/layout/Disclaimer'

const TOOLS = [
  { to: '/tools/inheritance', title: 'محاسبه سهم‌الارث', desc: 'طبقه اول (پدر، مادر، فرزندان) و همسر — بر اساس مواد ۸۹۲ تا ۹۴۹ قانون مدنی', icon: Calculator },
  { to: '/tools/diyeh', title: 'محاسبه دیه', desc: 'قتل، اعضا، منافع و جراحات سر و صورت — با نرخ رسمی سال ۱۴۰۵', icon: Coins },
  { to: '/tools/scan', title: 'اسکن QR ماده', desc: 'باز کردن مستقیم ماده از روی QR کد اشتراک‌گذاری‌شده', icon: QrCode },
]

export default function ToolsPage() {
  return (
    <div className="pb-2">
      <AppBar back title="ابزارهای حقوقی" />
      <main className="mx-auto max-w-3xl space-y-3 px-4 pt-4">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-soft active:scale-[0.985]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
              <t.icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{t.title}</span>
              <span className="block text-[12.5px] leading-6 text-muted">{t.desc}</span>
            </span>
            <ChevronLeft className="h-5 w-5 text-muted" />
          </Link>
        ))}
        <Disclaimer className="mt-4" />
      </main>
    </div>
  )
}
