import ExamRunner from '@/components/exam/exam-runner';
import { EXAMS } from '@/lib/exam/exams';
import { getExam } from '@/lib/exam/exams';

/** ۱۰۰ صفحهٔ آزمون به‌صورت استاتیک ساخته می‌شوند (مثل صفحات قانون) */
export function generateStaticParams() {
  return EXAMS.map((exam) => ({ examId: exam.id }));
}

export const dynamicParams = false;

export default function Page() {
  return <ExamRunner />;
}

export const dynamic = 'force-static';

export function generateMetadata({ params }: { params: { examId: string } }) {
  const exam = getExam(params.examId);
  return {
    title: exam ? `${exam.title} | کتابچه قانون ایران` : 'آزمون | کتابچه قانون ایران',
  };
}
