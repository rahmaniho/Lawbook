import Link from 'next/link';
import { ArrowLeft, FilePenLine } from 'lucide-react';
import { SectionHeading } from '@/components/bits';
import { Badge, Card } from '@/components/ui/primitives';
import { CONTRACTS, CONTRACT_TOPICS } from '@/lib/contracts';
import { toFaDigits } from '@/lib/fa';
import configJson from '@data/contracts/draft-config.json';
import suggestionJson from '@data/contracts/clause-suggestions.json';
import type { DraftConfig, SuggestionCatalog } from '@/lib/contract-drafting';

const config = configJson as DraftConfig;
const catalog = suggestionJson as SuggestionCatalog;
const clauseCount = CONTRACTS.reduce((total, contract) => total + contract.clauses.length, 0);

export default function DraftContractsPage() {
  return (
    <div className="app-container pb-10">
      <SectionHeading title="قراردادنویس تخصصی" subtitle="انتخاب موضوع، بررسی مخاطرات حقوقی، تنظیم بند و پیش‌نمایش برای بازبینی" />
      <Card className="border-primary/20 bg-primary/5 p-4 text-[12px] leading-7">
        <FilePenLine size={20} className="mb-2 text-primary" />
        برای {toFaDigits(CONTRACTS.length)} عنوان در هفت دسته، {toFaDigits(clauseCount)} متن پیشنهادی اختصاصی در دسترس است. هر متن، جای‌خالی‌ها و محور بررسی خود را دارد؛ فقط با انتخاب شما وارد پیش‌نویس می‌شود و پیش از چاپ باید با مدارک واقعی و قانون روز تطبیق یابد. پیوند مادهٔ قانونی تنها جایی نمایش داده می‌شود که ارتباط مشخصی برای مطالعه وجود دارد، نه برای تأیید تمام شروط بند.
        <p className="mt-2 font-medium text-amber-800 dark:text-amber-300">این ابزار سند آمادهٔ امضا تهیه نمی‌کند. موضوعات ثبتی و خانوادگیِ نشان‌دار صرفاً کاربرگ بررسی‌اند؛ حتی سایر پیش‌نویس‌ها نیز نیازمند بازبینی متخصص و بررسی شرایط اختصاصی پرونده هستند.</p>
        <p className="mt-1 text-[11px] text-muted-foreground">اطلاعات فرم فقط در حافظهٔ همین صفحه باقی می‌مانند و با خروج یا بارگذاری دوباره پاک می‌شوند.</p>
      </Card>
      <div className="mt-5 space-y-5">
        {CONTRACT_TOPICS.map((topic) => {
          const items = CONTRACTS.filter((contract) => contract.topic === topic.id);
          return (
            <section key={topic.id} id={topic.id}>
              <h2 className="mb-2 text-[14px] font-bold">{topic.title} <span className="text-[11px] font-normal text-muted-foreground">({toFaDigits(items.length)} عنوان)</span></h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((contract) => (
                  <Link key={contract.id} href={`/contracts/draft/${contract.id}`} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Card className="flex h-full items-start justify-between gap-2 p-3 transition-colors hover:border-primary/50">
                      <div>
                        <h3 className="text-[12px] font-semibold">{contract.title}</h3>
                        <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">{catalog.introductions[contract.id]}</p>
                        {config.formalWorkbooks[contract.id]
                          ? <Badge tone="warning" className="mt-2">کاربرگ بررسی؛ نه سند رسمی</Badge>
                          : <Badge tone="muted" className="mt-2">{toFaDigits(contract.clauses.length)} بند تخصصی برای ویرایش</Badge>}
                      </div>
                      <ArrowLeft size={15} className="mt-1 shrink-0 text-primary" />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
