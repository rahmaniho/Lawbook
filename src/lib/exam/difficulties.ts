/**
 * آزمون اختبار — سطوح دشواری مجاز سوالات بانک.
 */

import type { ExamDifficulty } from './types';

/** سطوح دشواری مجاز؛ برای اعتبارسنجی بانک و فرم‌های افزودن سوال */
export const EXAM_DIFFICULTIES: readonly ExamDifficulty[] = ['آسان', 'متوسط', 'سخت'] as const;
