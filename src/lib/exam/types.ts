/**
 * آزمون اختبار — نوع‌های داده و ساختار دسته‌بندی‌ها.
 *
 * این ماژول «آزمون اختبار» کتابچه قانون را تعریف می‌کند: ۱۰۰ آزمون مجازی
 * در ۹ حوزهٔ حقوقی که هر یک ۵ سوال تصادفی از بانک سوالات همان حوزه می‌گیرد
 * و ۳۰ دقیقه زمان پاسخ‌گویی دارد. همهٔ نوع‌ها و ثابت‌های مشترک این‌جاست تا
 * بانک سوالات، منطق برگزاری و رابط کاربری از یک منبع واحد تغذیه شوند.
 */

/** شناسهٔ دسته‌بندی آزمون (لاتین، برای URL و کلیدهای داخلی) */
export type ExamCategoryId =
  | 'civil'
  | 'civil-procedure'
  | 'commercial'
  | 'criminal'
  | 'criminal-procedure'
  | 'registration'
  | 'fiqh'
  | 'constitutional'
  | 'probate';

/** سطح دشواری سوال */
export type ExamDifficulty = 'آسان' | 'متوسط' | 'سخت';

/** ساختار هر سوال بانک سوالات (هم‌اريز ساختار questions.js در طرح اولیه) */
export interface ExamQuestion {
  /** شناسهٔ یکتا؛ در زمان ادغام بانک به‌صورت خودکار و پایدار تعیین می‌شود */
  id: number;
  /** شناسهٔ دسته‌بندی (نام فارسی از EXAM_CATEGORIES گرفته می‌شود) */
  category: ExamCategoryId;
  /** متن سوال */
  question: string;
  /** چهار گزینهٔ پاسخ */
  options: [string, string, string, string];
  /** ایندکس گزینهٔ صحیح (۰ تا ۳) */
  correctAnswer: 0 | 1 | 2 | 3;
  /** سطح دشواری */
  difficulty: ExamDifficulty;
  /** مستند قانونی/فقهی سوال، مانند «ماده ۱۹۰ قانون مدنی» */
  source: string;
}

/** سوال خامِ داخل فایل‌های بانک؛ id در زمان ادغام افزوده می‌شود */
export type ExamQuestionSeed = Omit<ExamQuestion, 'id'>;

/** تعریف یک دسته‌بندی آزمون */
export interface ExamCategoryDef {
  id: ExamCategoryId;
  /** عنوان فارسی نمایشی */
  title: string;
  /** توضیح کوتاه حوزهٔ موضوعی */
  description: string;
  /** تعداد آزمون‌های این دسته (مجموع = ۱۰۰) */
  examCount: number;
  /** تعداد سوال هر آزمون */
  questionsPerExam: number;
  /** زمان هر آزمون به دقیقه */
  durationMinutes: number;
  /** رنگ شاخص دسته (هگز) برای نشان و نوار پیشرفت */
  color: string;
}

/** مشخصات یک آزمون از ۱۰۰ آزمون مجموعه */
export interface ExamMeta {
  /** شناسهٔ یکتا، مانند civil-1 */
  id: string;
  /** عنوان نمایشی، مانند «آزمون حقوق مدنی — سری ۱» */
  title: string;
  category: ExamCategoryId;
  /** شمارهٔ سری درون دسته (۱ تا examCount) */
  series: number;
  questionsPerExam: number;
  durationMinutes: number;
}

/** وضعیت آزمونِ در جریان (در localStorage ذخیره می‌شود) */
export interface ExamState {
  examId: string;
  /** شناسهٔ سوالات انتخاب‌شده برای این نوبت */
  questionIds: number[];
  /** پاسخ کاربر به هر سوال (null = بی‌پاسخ) */
  answers: (number | null)[];
  /** شاخص سوالی که کاربر آخرین بار روی آن بوده */
  currentIndex: number;
  /** زمان شروع (epoch ms) */
  startedAt: number;
  /** مهلت پایان (epoch ms) — با آن محاسبهٔ زمان باقی‌مانده در برابر رفرش مقاوم است */
  deadlineTs: number;
}

/** کارنامهٔ ذخیره‌شدهٔ هر آزمون در تاریخچه */
export interface ExamHistoryEntry {
  examId: string;
  /** بهترین درصد در کل تلاش‌ها */
  bestPercent: number;
  /** درصد آخرین تلاش */
  lastPercent: number;
  /** تعداد تلاش‌ها */
  attempts: number;
  /** تاریخ آخرین تلاش (epoch ms) */
  lastAt: number;
}

/** نتیجهٔ محاسبه‌شدهٔ یک نوبت آزمون */
export interface ExamScore {
  correct: number;
  total: number;
  percent: number;
  /** پیام متناسب با درصد */
  message: string;
}
