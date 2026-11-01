import Link from 'next/link';
import { CONTRACT_DISCLAIMER, CONTRACT_TOPIC_GUIDES, CONTRACT_LESSONS, contractsByTopic } from '@/lib/contracts';
import { SectionHeading } from '@/components/bits';
import { Card } from '@/components/ui/primitives';
import { toFaDigits } from '@/lib/fa';

export const metadata = { title: 'آموزش گام‌به‌گام قرارداد‌نویسی | کتابچه حقوق' };

export default function ContractLessons() {
  return <div className="app-container pb-10">
    <Link href="/contracts" className="mt-4 inline-block text-sm text-primary">بازگشت به نمونه قراردادها</Link>
    <SectionHeading title="آموزش گام‌به‌گام قرارداد‌نویسی" subtitle="روش تنظیم بند، خطاهای رایج، تمرین و چک‌لیست" />
    <Card className="my-4 p-4 text-xs leading-7">{CONTRACT_DISCLAIMER}</Card>
    <nav aria-label="فهرست آموزش‌ها" className="my-4 grid gap-2 text-sm">
      {CONTRACT_LESSONS.map((lesson, index) => <a key={lesson.id} href={`#${lesson.id}`} className="text-primary underline">{toFaDigits(index + 1)}. {lesson.title}</a>)}
      <a href="#topics" className="text-primary underline">راهنماهای اختصاصی انواع قرارداد</a>
    </nav>
    <div className="space-y-4">
      {CONTRACT_LESSONS.map((lesson, index) => <Card key={lesson.id} id={lesson.id} className="scroll-mt-24 space-y-3 p-4 text-sm leading-8">
        <h2 className="font-bold text-primary">درس {toFaDigits(index + 1)}: {lesson.title}</h2>
        {lesson.sections.map((section) => <section key={section.title}><h3 className="font-semibold">{section.title}</h3><p>{section.text}</p></section>)}
        <h3 className="font-semibold">چک‌لیست بازبینی</h3>
        <ul className="list-inside list-disc">{lesson.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className="rounded-xl bg-muted p-3"><strong>تمرین: </strong>{lesson.exercise}</p>
      </Card>)}
    </div>
    <h2 id="topics" className="my-5 scroll-mt-24 text-lg font-bold">راهنمای اختصاصی انواع قرارداد</h2>
    <div className="space-y-4">{CONTRACT_TOPIC_GUIDES.map((guide) => <Card key={guide.topic} id={guide.topic} className="scroll-mt-24 p-4 text-sm leading-8">
      <h3 className="font-semibold text-primary">{guide.title}</h3><p>{guide.text}</p>
      <ul className="list-inside list-disc">{guide.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="mt-2 font-semibold">تمرین روی نمونه‌های این موضوع:</p>
      {contractsByTopic(guide.topic).slice(0, 3).map((c) => <Link key={c.id} href={`/contracts/${c.id}`} className="block text-primary underline">{c.title} — الگو و نمونه تکمیل‌شده</Link>)}
    </Card>)}</div>
  </div>;
}
