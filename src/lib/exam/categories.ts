/**
 * آزمون اختبار — جدول توزیع ۱۰۰ آزمون بین حوزه‌های حقوقی.
 *
 * مجموع examCountها باید دقیقاً ۱۰۰ باشد؛ آزمون‌های فهرست در exams.ts به‌صورت
 * برنامه‌ای از همین جدول ساخته می‌شوند. ترتیب آرایه، ترتیب نمایش دسته‌ها در
 * فیلتر صفحهٔ فهرست نیز هست.
 */

import type { ExamCategoryDef, ExamCategoryId } from './types';

export const EXAM_CATEGORIES: ExamCategoryDef[] = [
  {
    id: 'civil',
    title: 'حقوق مدنی',
    description: 'اشخاص، اموال، قراردادها، تعهدات، مالکیت و ارث',
    examCount: 20,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#0d9488',
  },
  {
    id: 'civil-procedure',
    title: 'آیین دادرسی مدنی',
    description: 'صلاحیت دادگاه، دادخواست، اجمالی و تجدیدنظر، اجرای احکام',
    examCount: 15,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#4f46e5',
  },
  {
    id: 'commercial',
    title: 'حقوق تجارت',
    description: 'تجار، اسناد تجاری، شرکت‌های تجاری، ورشکستگی',
    examCount: 15,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#b45309',
  },
  {
    id: 'criminal',
    title: 'حقوق جزای عمومی و اختصاصی',
    description: 'قانون مجازات اسلامی: حدود، قصاص، دیات و تعزیرات',
    examCount: 15,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#b91c1c',
  },
  {
    id: 'criminal-procedure',
    title: 'آیین دادرسی کیفری',
    description: 'کشف جرم، تحقیقات مقدماتی، دادسرا و صلاحیت‌های کیفری',
    examCount: 10,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#7c3aed',
  },
  {
    id: 'registration',
    title: 'حقوق ثبت',
    description: 'ثبت اسناد و املاک، املاک ممنوع‌الثبت و تنظیم اسناد',
    examCount: 10,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#0369a1',
  },
  {
    id: 'fiqh',
    title: 'فقه و اصول',
    description: 'قواعد فقهی و اصول استنباط، منابع و ادلهٔ احکام',
    examCount: 5,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#15803d',
  },
  {
    id: 'constitutional',
    title: 'حقوق اساسی',
    description: 'قانون اساسی جمهوری اسلامی ایران، نهادها و حقوق ملت',
    examCount: 5,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#be185d',
  },
  {
    id: 'probate',
    title: 'امور حسبی',
    description: 'قانون امور حسبی: وصیت‌نامه، حجر، غایب و امور ثبت احوال',
    examCount: 5,
    questionsPerExam: 5,
    durationMinutes: 30,
    color: '#a16207',
  },
];

/** مجموع آزمون‌ها باید ۱۰۰ بماند؛ در آزمون‌های خودکار پایش می‌شود. */
export const TOTAL_EXAMS = EXAM_CATEGORIES.reduce((sum, c) => sum + c.examCount, 0);

export function getCategory(id: ExamCategoryId): ExamCategoryDef | undefined {
  return EXAM_CATEGORIES.find((c) => c.id === id);
}
