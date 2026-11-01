import { AlertTriangle, Target } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { getTopicLearning } from '@/lib/contracts';
import { toFaDigits } from '@/lib/fa';

export function ContractLearningPanel({ topicId }: { topicId: string }) {
  const learning = getTopicLearning(topicId);
  if (!learning) return null;

  return (
    <section className="mt-5 space-y-3" aria-label="اهداف یادگیری و نکات مهم">
      <Card className="p-4">
        <h2 className="flex items-center gap-2 text-[13px] font-bold"><Target size={17} className="text-primary" /> اهداف یادگیری این بخش</h2>
        <ol className="mt-3 space-y-3">
          {learning.goals.map((goal, index) => (
            <li key={goal.id} className="flex items-start gap-2.5 text-[11.5px] leading-6">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{toFaDigits(index + 1)}</span>
              <span><strong className="block text-foreground">{goal.title}</strong><span className="text-muted-foreground">{goal.outcome}</span></span>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="border-amber-500/25 bg-amber-500/5 p-4">
        <h2 className="flex items-center gap-2 text-[12.5px] font-bold"><AlertTriangle size={16} className="text-amber-600" /> نکات مهم پیش از استفاده واقعی</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[11.5px] leading-6 text-muted-foreground">
          {learning.criticalPoints.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </Card>
    </section>
  );
}
