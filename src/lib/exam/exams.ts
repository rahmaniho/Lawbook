/**
 * آزمون اختبار — فهرست ۱۰۰ آزمون، منطق انتخاب تصادفی سوالات و محاسبهٔ نمره.
 *
 * ۱۰۰ آزمون بر اساس جدول توزیع، به‌صورت برنامه‌ای از EXAM_CATEGORIES ساخته
 * می‌شوند؛ هر آزمون در زمان «شروع»، ۵ سوال تصادفی و بدون تکرار از بانک
 * سوالات دستهٔ خودش می‌گیرد. انتخاب سوال و محاسبهٔ نمره خالص (بدون DOM)
 * است تا در آزمون‌های خودکار هم قابل اجرا باشد.
 */

import { EXAM_CATEGORIES } from './categories';
import { QUESTION_BANK, questionsOfCategory } from './questions';
import { toFaDigits } from '../fa';
import type {
  ExamCategoryDef,
  ExamCategoryId,
  ExamMeta,
  ExamQuestion,
  ExamScore,
} from './types';

/** پیشوند عنوان آزمون‌ها بر پایهٔ نام دسته (شمارهٔ سری با ارقام فارسی) */
function examTitle(cat: ExamCategoryDef, series: number): string {
  return `آزمون ${cat.title} — سری ${toFaDigits(series)}`;
}

/** فهرست کامل ۱۰۰ آزمون، مرتب بر اساس دسته و شمارهٔ سری */
export const EXAMS: ExamMeta[] = EXAM_CATEGORIES.flatMap((cat) =>
  Array.from({ length: cat.examCount }, (_, i) => ({
    id: `${cat.id}-${i + 1}`,
    title: examTitle(cat, i + 1),
    category: cat.id,
    series: i + 1,
    questionsPerExam: cat.questionsPerExam,
    durationMinutes: cat.durationMinutes,
  })),
);

/** یافتن آزمون با شناسه؛ مانند civil-3 */
export function getExam(examId: string): ExamMeta | undefined {
  return EXAMS.find((e) => e.id === examId);
}

/** یافتن تعریف دسته با شناسه */
export function getExamCategory(id: ExamCategoryId | string): ExamCategoryDef | undefined {
  return EXAM_CATEGORIES.find((c) => c.id === id);
}

/** عنوان دسته یا خودِ شناسه (برای پیام خطا) */
export function categoryTitle(id: string): string {
  return getExamCategory(id)?.title ?? id;
}

/**
 * تابع تصادفی قابل تزریق (برای آزمون‌پذیری). پیش‌فرض Math.random.
 */
export type RandomFn = () => number;

/** الگوریتم Fisher–Yates برای به‌هم‌ریختن آرایه (کپی برمی‌گرداند) */
export function shuffle<T>(input: readonly T[], random: RandomFn = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * انتخاب تصادفیِ n سوال از یک دسته، بدون تکرار در یک آزمون.
 * اگر دسته سوال کافی نداشته باشد، همهٔ سوالات موجود برگردانده می‌شوند
 * و تعداد واقعی خروجی ممکن است کمتر از n باشد (شرط کفِ بانک در آزمون‌ها
 * پایش می‌شود: هر دسته دست‌کم examCount × questionsPerExam سوال دارد).
 */
export function pickQuestions(
  category: ExamCategoryId,
  count = 5,
  random: RandomFn = Math.random,
): ExamQuestion[] {
  const pool = questionsOfCategory(category);
  return shuffle(pool, random).slice(0, Math.min(count, pool.length));
}

/** حداقلِ سوالات لازم هر دسته تا همهٔ سری‌های آن بتوانند ۵ سوال بگیرند */
export function requiredQuestionCount(cat: ExamCategoryDef): number {
  return cat.examCount * cat.questionsPerExam;
}

/** آمار کلی بانک سوالات برای صفحهٔ فهرست */
export function bankStats(): { total: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  for (const q of QUESTION_BANK) byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
  return { total: QUESTION_BANK.length, byCategory };
}

/** پیام متناسب با درصد نمره */
export function scoreMessage(percent: number): string {
  if (percent >= 90) return 'عالی! تسلط شما بر این مبحث درخشان است.';
  if (percent >= 70) return 'خوب! با مرور نکات ضعیف، به تسلط کامل می‌رسید.';
  if (percent >= 50) return 'متوسط؛ مبانی را دارید و تمرین بیشتر لازم است.';
  return 'نیاز به مطالعه بیشتر؛ مواد مرتبط را در «قوانین» بخوانید و دوباره تلاش کنید.';
}

/** محاسبهٔ نمره از مقایسهٔ پاسخ‌ها با سوالات */
export function computeScore(questions: ExamQuestion[], answers: (number | null)[]): ExamScore {
  const total = questions.length;
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] !== null && answers[i] !== undefined && answers[i] === q.correctAnswer) correct++;
  });
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percent, message: scoreMessage(percent) };
}

/** قالب‌بندی ثانیه به «mm:ss» با ارقام فارسی */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const fa = (v: string) => v.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  return fa(`${mm}:${ss}`);
}
