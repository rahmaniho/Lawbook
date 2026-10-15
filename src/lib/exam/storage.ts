/**
 * آزمون اختبار — ذخیره‌سازی وضعیت و تاریخچه در localStorage.
 *
 * همهٔ توابع نسبت به نبودِ window (SSR یا محیط تست) مقاوم‌اند و در آن
 * حالت مقدار خالی برمی‌گردانند تا هیچ‌گاه اجرای سرور را نشکنند.
 *
 * چیدمان کلیدها:
 *  - `exam-state:<examId>`   → آزمون در جریان (ادامهٔ پس از بستن صفحه/رفرش)
 *  - `exam-history`          → کارنامهٔ آزمون‌ها (بهترین/آخرین درصد هر آزمون)
 */

import type { ExamHistoryEntry, ExamState } from './types';

const HISTORY_KEY = 'exam-history';
const stateKey = (examId: string) => `exam-state:${examId}`;

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/* ---------------------------------- وضعیت ---------------------------------- */

/** خواندن وضعیت آزمون در جریان (اگر نباشد undefined) */
export function loadExamState(examId: string): ExamState | undefined {
  const s = storage();
  if (!s) return undefined;
  try {
    const raw = s.getItem(stateKey(examId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ExamState;
    if (
      !parsed ||
      parsed.examId !== examId ||
      !Array.isArray(parsed.questionIds) ||
      !Array.isArray(parsed.answers) ||
      typeof parsed.deadlineTs !== 'number'
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/** ذخیرهٔ وضعیت آزمون در جریان */
export function saveExamState(state: ExamState): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(stateKey(state.examId), JSON.stringify(state));
  } catch {
    /* پر بودن فضای ذخیره‌سازی نادیده گرفته می‌شود */
  }
}

/** حذف وضعیت آزمون در جریان (پس از پایان) */
export function clearExamState(examId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(stateKey(examId));
  } catch {
    /* ignore */
  }
}

/* --------------------------------- تاریخچه --------------------------------- */

/** همهٔ کارنامه‌ها؛ کلید = شناسهٔ آزمون */
export function loadHistory(): Record<string, ExamHistoryEntry> {
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ExamHistoryEntry>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/** ثبت یک تلاش پایان‌یافته در تاریخچه (بهترین درصد و تعداد تلاش‌ها به‌روز می‌شود) */
export function recordAttempt(examId: string, percent: number, at = Date.now()): void {
  const s = storage();
  if (!s) return;
  try {
    const all = loadHistory();
    const prev = all[examId];
    all[examId] = {
      examId,
      bestPercent: Math.max(percent, prev?.bestPercent ?? -1),
      lastPercent: percent,
      attempts: (prev?.attempts ?? 0) + 1,
      lastAt: at,
    };
    s.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** پاک کردن کل تاریخچهٔ آزمون‌ها (از صفحهٔ تنظیمات) */
export function clearAllExamData(): void {
  const s = storage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && (k === HISTORY_KEY || k.startsWith('exam-state:'))) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    /* ignore */
  }
}
