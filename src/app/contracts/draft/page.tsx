import Link from 'next/link';
import { ArrowLeft, FilePenLine } from 'lucide-react';
import { SectionHeading } from '@/components/bits';
import { Badge, Card } from '@/components/ui/primitives';
import { CONTRACTS, CONTRACT_TOPICS } from '@/lib/contracts';
import configJson from '@data/contracts/draft-config.json';
import type { DraftConfig } from '@/lib/contract-drafting';

const config = configJson as DraftConfig;

export default function DraftContractsPage() {
  return (
    <div className="app-container pb-10">
      <SectionHeading title="قراردادنویس" subtitle="ورود اطلاعات، پیشنهاد متن با مواد مرتبط، ویرایش بندها و چاپ" />
      <Card className="border-primary/20 bg-primary/5 p-4 text-[12px] leading-7">
        <FilePenLine size={20} className="mb-2 text-primary" />
        از میان {CONTRACTS.length.toLocaleString('fa-IR')} عنوان یکی را انتخاب کنید. برای دو بند هر عنوان، پیشنهاد متنی همراه با پیوند ماده‌های مرتبط ارائه شده است؛ می‌توانید آن را آگاهانه درج و ویرایش کنید یا متن خودتان را بنویسید. جای‌خالی‌ها باید تکمیل شوند. فرم روی همین دستگاه باقی می‌ماند و با خروج از صفحه پاک می‌شود. استنادهای پیشنهادی، جای بازبینی حقوقی یا تشریفات رسمی را نمی‌گیرند.
      </Card>
      <div className="mt-5 space-y-5">
        {CONTRACT_TOPICS.map((topic) => {
          const items = CONTRACTS.filter((contract) => contract.topic === topic.id);
          return (
            <section key={topic.id} id={topic.id}>
              <h2 className="mb-2 text-[14px] font-bold">{topic.title} <span className="text-[11px] font-normal text-muted-foreground">({items.length.toLocaleString('fa-IR')} عنوان)</span></h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((contract) => (
                  <Link key={contract.id} href={`/contracts/draft/${contract.id}`} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Card className="flex h-full items-start justify-between gap-2 p-3 transition-colors hover:border-primary/50">
                      <div><h3 className="text-[12px] font-semibold">{contract.title}</h3><p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">{contract.summary}</p>
                        {config.formalWorkbooks[contract.id] ? <Badge className="mt-2 border-amber-500/30 text-amber-700">کاربرگ اطلاعات رسمی</Badge> : null}
                      </div><ArrowLeft size={15} className="mt-1 shrink-0 text-primary" />
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
