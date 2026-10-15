/**
 * آزمون اختبار — بانک سوالات.
 *
 * ادغام ۹ فایل حوزه‌ای به یک بانک واحد با شناسهٔ عددی پایدار:
 * ترتیب merge همان ترتیب EXAM_CATEGORIES است و شناسه‌ها به همان ترتیب
 * تخصیص می‌یابند؛ بنابراین تا وقتی فایل‌های حوزه‌ای فقط «در انتهای آرایه»
 * سوال جدید بگیرند، شناسهٔ سوالات موجود هرگز تغییر نمی‌کند و تاریخچهٔ
 * ذخیره‌شدهٔ کاربران معتبر می‌ماند.
 *
 * افزودن سوال جدید: به انتهای آرایهٔ فایل حوزهٔ مربوط اضافه شود (بدون id).
 */

import { EXAM_CATEGORIES } from '../categories';
import type { ExamCategoryId, ExamQuestion, ExamQuestionSeed } from '../types';

import { civilQuestions } from './civil';
import { civilProcedureQuestions } from './civil-procedure';
import { commercialQuestions } from './commercial';
import { criminalQuestions } from './criminal';
import { criminalProcedureQuestions } from './criminal-procedure';
import { registrationQuestions } from './registration';
import { fiqhQuestions } from './fiqh';
import { constitutionalQuestions } from './constitutional';
import { probateQuestions } from './probate';

/** سوالات خام هر حوزه، به ترتیبِ فهرست دسته‌بندی‌ها */
const SEEDS_BY_CATEGORY: Record<ExamCategoryId, ExamQuestionSeed[]> = {
  civil: civilQuestions,
  'civil-procedure': civilProcedureQuestions,
  commercial: commercialQuestions,
  criminal: criminalQuestions,
  'criminal-procedure': criminalProcedureQuestions,
  registration: registrationQuestions,
  fiqh: fiqhQuestions,
  constitutional: constitutionalQuestions,
  probate: probateQuestions,
};

/** بانک سوالات با شناسهٔ عددی پایدار (۱ تا N، به ترتیب merge دسته‌ها) */
export const QUESTION_BANK: ExamQuestion[] = (() => {
  const bank: ExamQuestion[] = [];
  let seq = 0;
  for (const cat of EXAM_CATEGORIES) {
    for (const seed of SEEDS_BY_CATEGORY[cat.id]) {
      seq += 1;
      bank.push({ ...seed, id: seq });
    }
  }
  return bank;
})();

/** سوالات یک دسته (به ترتیب شناسه) */
export function questionsOfCategory(category: ExamCategoryId): ExamQuestion[] {
  return QUESTION_BANK.filter((q) => q.category === category);
}

/** یافتن سوال با شناسهٔ عددی */
export function questionById(id: number): ExamQuestion | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}
