'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardCheck,
  Clock, GraduationCap, ListChecks, RotateCcw, TimerReset, X,
} from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui/primitives';
import { getExam, getExamCategory, computeScore, formatClock, pickQuestions } from '@/lib/exam/exams';
import { clearExamState, loadExamState, recordAttempt, saveExamState } from '@/lib/exam/storage';
import { questionById } from '@/lib/exam/questions';
import type { ExamQuestion, ExamState } from '@/lib/exam/types';
import { toFaDigits } from '@/lib/fa';
import { cn } from '@/lib/utils';

type Phase = 'loading' | 'intro' | 'running' | 'result';

export default function ExamRunner() {
  const params = useParams<{ examId: string }>();
  const examId = params?.examId ?? '';
  const exam = getExam(examId);
  const cat = exam ? getExamCategory(exam.category) : undefined;

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [resumable, setResumable] = useState<ExamState | null>(null);
  const finishRef = useRef<
    ((qs: ExamQuestion[], ans: (number | null)[], silent?: boolean) => void) | null
  >(null);

  /* ---------------- پایان آزمون (با پاسخ‌های فعلی) ---------------- */
  const finish = useCallback(
    (qs: ExamQuestion[], ans: (number | null)[], silent = false) => {
      const score = computeScore(qs, ans);
      recordAttempt(examId, score.percent);
      clearExamState(examId);
      setQuestions(qs);
      setAnswers(ans);
      setDeadline(null);
      setResumable(null);
      setPhase('result');
      if (!silent) window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [examId],
  );
  finishRef.current = finish;

  /* ---------------- خواندن وضعیت ذخیره‌شده در نخستین اجرا ---------------- */
  useEffect(() => {
    if (!exam) return;
    const saved = loadExamState(examId);
    if (saved) {
      const qs = saved.questionIds
        .map((id) => questionById(id))
        .filter((q): q is ExamQuestion => Boolean(q));
      if (qs.length > 0 && qs.length === saved.questionIds.length) {
        if (saved.deadlineTs <= Date.now()) {
          /* مهلت تمام شده → کارنامهٔ همان پاسخ‌ها */
          finishRef.current?.(qs, saved.answers, true);
          return;
        }
        setResumable(saved);
      } else {
        clearExamState(examId);
      }
    }
    setPhase('intro');
  }, [exam, examId]);

  /* ---------------- شروع آزمون (تازه یا ادامهٔ ذخیره‌شده) ---------------- */
  const start = useCallback(
    (resume: ExamState | null = null) => {
      if (!exam) return;
      let qs: ExamQuestion[];
      let ans: (number | null)[];
      let deadlineTs: number;
      let idx: number;
      if (resume) {
        qs = resume.questionIds.map((id) => questionById(id)!).filter(Boolean);
        ans = resume.answers;
        deadlineTs = resume.deadlineTs;
        idx = Math.min(resume.currentIndex, qs.length - 1);
      } else {
        qs = pickQuestions(exam.category, exam.questionsPerExam);
        ans = qs.map(() => null);
        deadlineTs = Date.now() + exam.durationMinutes * 60_000;
        idx = 0;
      }
      setQuestions(qs);
      setAnswers(ans);
      setCurrent(idx);
      setDeadline(deadlineTs);
      setRemaining(Math.max(0, Math.round((deadlineTs - Date.now()) / 1000)));
      setResumable(null);
      setPhase('running');
      saveExamState({
        examId,
        questionIds: qs.map((q) => q.id),
        answers: ans,
        currentIndex: idx,
        startedAt: Date.now(),
        deadlineTs,
      });
    },
    [exam, examId],
  );

  /* ---------------- تایمر معکوسِ مقاوم به رفرش ---------------- */
  useEffect(() => {
    if (phase !== 'running' || deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setAnswers((ans) => {
          finishRef.current?.(questions, ans, true);
          return ans;
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline]);

  /* ---------------- ثبت پاسخ ---------------- */
  const answer = (optionIndex: number) => {
    if (phase !== 'running') return;
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = optionIndex;
      saveExamState({
        examId,
        questionIds: questions.map((q) => q.id),
        answers: next,
        currentIndex: current,
        startedAt: Date.now(),
        deadlineTs: deadline ?? Date.now(),
      });
      return next;
    });
  };

  const go = (delta: 1 | -1) =>
    setCurrent((i) => Math.min(questions.length - 1, Math.max(0, i + delta)));

  const answeredCount = answers.filter((a) => a !== null).length;
  const score = useMemo(
    () => (phase === 'result' ? computeScore(questions, answers) : null),
    [phase, questions, answers],
  );

  /* ---------------- آزمون نایافت/نامعتبر ---------------- */
  if (!exam || !cat) {
    return (
      <div className="app-container pb-10">
        <EmptyState
          icon={<AlertTriangle size={22} />}
          title="آزمون پیدا نشد"
          description="شناسهٔ آزمون درست نیست یا این آزمون حذف شده است."
          action={
            <Link href="/exam">
              <Button variant="outline" size="sm">
                <ArrowRight size={14} /> بازگشت به فهرست آزمون‌ها
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  /* ---------------- بارگذاری اولیه ---------------- */
  if (phase === 'loading') {
    return (
      <div className="app-container pb-10">
        <div className="skeleton mt-6 h-8 w-2/3" />
        <div className="skeleton mt-4 h-40 w-full" />
      </div>
    );
  }

  /* ---------------- پیش از شروع ---------------- */
  if (phase === 'intro') {
    return (
      <div className="app-container pb-10">
        <Link href="/exam" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <ArrowRight size={13} /> فهرست آزمون‌ها
        </Link>

        <Card className="mt-4 overflow-hidden">
          <div
            className="flex items-center gap-3 p-5 text-white"
            style={{ backgroundColor: cat.color }}
          >
            <GraduationCap size={30} />
            <div>
              <h1 className="text-base font-bold">{exam.title}</h1>
              <p className="mt-0.5 text-[11.5px] opacity-90">{cat.title} — {cat.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-x-reverse p-4 text-center">
            <IntroStat icon={<ListChecks size={15} />} value={toFaDigits(exam.questionsPerExam)} label="سوال" />
            <IntroStat icon={<Clock size={15} />} value={toFaDigits(exam.durationMinutes)} label="دقیقه" />
            <IntroStat icon={<ClipboardCheck size={15} />} value={`${toFaDigits(Math.round(100 / exam.questionsPerExam))}٪`} label="به ازای هر سوال" />
          </div>
          <div className="border-t bg-muted/30 px-4 py-3 text-[11px] leading-6 text-muted-foreground">
            سوال‌های این آزمون به‌صورت تصادفی از بانک سوالات «{cat.title}» انتخاب می‌شوند.
            زمان‌سنج پس از بستن صفحه هم ادامه دارد و با بازگشت، از همان‌جا می‌توانید ادامه دهید.
            {resumable
              ? ' یک نوبت نیمه‌کاره برای این آزمون ذخیره شده است؛ می‌توانید ادامه دهید یا از نو شروع کنید.'
              : ''}
          </div>
          <div className="flex gap-2 p-4">
            {resumable ? (
              <>
                <Button className="flex-1" onClick={() => start(resumable)}>
                  <TimerReset size={15} /> ادامهٔ آزمون ذخیره‌شده
                </Button>
                <Button variant="outline" onClick={() => start(null)}>
                  <RotateCcw size={15} /> از نو
                </Button>
              </>
            ) : (
              <Button className="w-full" size="lg" onClick={() => start(null)}>
                شروع آزمون
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  /* ---------------- کارنامه ---------------- */
  if (phase === 'result' && score) {
    const tone =
      score.percent >= 70
        ? 'text-emerald-600 dark:text-emerald-400'
        : score.percent >= 50
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';
    return (
      <div className="app-container pb-10">
        <Link href="/exam" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <ArrowRight size={13} /> فهرست آزمون‌ها
        </Link>

        <Card className="mt-4 p-5 text-center">
          <div className="eyebrow">کارنامهٔ {exam.title}</div>
          <div className={cn('mt-4 text-5xl font-black tabular-nums', tone)}>
            {toFaDigits(score.percent)}
            <span className="text-2xl">٪</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {toFaDigits(score.correct)} پاسخ درست از {toFaDigits(score.total)} سوال
          </p>
          {/* حلقهٔ درصد */}
          <div className="mx-auto mt-4 h-2.5 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${score.percent}%` }}
            />
          </div>
          <p className="mt-4 text-[12.5px] font-medium leading-6">{score.message}</p>
        </Card>

        <div className="mt-3 flex gap-2">
          <Link href="/exam" className="flex-1">
            <Button variant="outline" className="w-full">
              <ArrowRight size={14} /> بازگشت به فهرست آزمون‌ها
            </Button>
          </Link>
          <Button className="flex-1" onClick={() => { setPhase('intro'); start(null); }}>
            <RotateCcw size={14} /> تلاش مجدد همین آزمون
          </Button>
        </div>

        <h2 className="mt-6 text-sm font-bold">پرسش‌ها و پاسخ‌ها</h2>
        <div className="mt-2 space-y-2.5">
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const correct = userAnswer === q.correctAnswer;
            return (
              <Card key={q.id} className="p-4">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
                      correct ? 'bg-emerald-600' : 'bg-red-600',
                    )}
                  >
                    {correct ? <Check size={12} /> : <X size={12} />}
                  </span>
                  <p className="flex-1 text-[12.5px] font-medium leading-6 select-none">{q.question}</p>
                </div>
                <div className="mt-3 space-y-1.5 pr-7">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correctAnswer;
                    const isUserPick = oi === userAnswer;
                    return (
                      <div
                        key={oi}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-[11.5px] leading-5',
                          isCorrect && 'border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                          !isCorrect && isUserPick && 'border-red-500/60 bg-red-500/10 text-red-800 dark:text-red-300',
                          !isCorrect && !isUserPick && 'bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {opt}
                        {isCorrect ? <span className="mr-1.5 font-semibold">(پاسخ صحیح)</span> : null}
                        {!isCorrect && isUserPick ? <span className="mr-1.5 font-semibold">(پاسخ شما)</span> : null}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2.5 pr-7 text-[10.5px] text-muted-foreground">
                  دشواری: {q.difficulty} — {q.source}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------- برگزاری ---------------- */
  const q = questions[current];
  const lowTime = remaining <= 60;
  return (
    <div className="app-container pb-10">
      {/* هدر چسبان: عنوان + تایمر */}
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 bg-background/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold">{exam.title}</p>
            <p className="text-[10.5px] text-muted-foreground">
              سوال {toFaDigits(current + 1)} از {toFaDigits(questions.length)}
            </p>
          </div>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums',
              lowTime ? 'animate-pulse bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-muted text-foreground',
            )}
            aria-live="polite"
          >
            <Clock size={15} />
            {formatClock(remaining)}
          </span>
        </div>
        {/* نوار پیشرفت */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-[10.5px] tabular-nums text-muted-foreground">
            {toFaDigits(answeredCount)}/{toFaDigits(questions.length)}
          </span>
        </div>
      </div>

      {/* سوال جاری */}
      <Card className="mt-3 p-4" onCopy={(e) => e.preventDefault()}>
        <p className="text-[13.5px] font-semibold leading-7 select-none" onCopy={(e) => e.preventDefault()}>
          {q.question}
        </p>
        <div className="mt-4 space-y-2">
          {q.options.map((opt, oi) => {
            const picked = answers[current] === oi;
            return (
              <button
                key={oi}
                onClick={() => answer(oi)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-right text-[12.5px] leading-6 transition-all active:scale-[0.99]',
                  picked
                    ? 'border-primary bg-primary/10 font-semibold text-primary shadow-card'
                    : 'bg-card text-foreground hover:border-primary/40',
                )}
                aria-pressed={picked}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors',
                    picked ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {toFaDigits(oi + 1)}
                </span>
                <span className="flex-1">{opt}</span>
                {picked ? <Check size={16} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[10.5px] text-muted-foreground">دشواری: {q.difficulty}</p>
      </Card>

      {/* ناوبری */}
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => go(-1)}
          disabled={current === 0}
        >
          <ChevronRight size={15} /> قبلی
        </Button>
        {current < questions.length - 1 ? (
          <Button className="flex-1" onClick={() => go(1)}>
            بعدی <ChevronLeft size={15} />
          </Button>
        ) : (
          <Button variant="destructive" className="flex-1" onClick={() => finish(questions, answers)}>
            <ClipboardCheck size={15} /> پایان آزمون
          </Button>
        )}
      </div>
      {current < questions.length - 1 ? (
        <Button
          variant="ghost"
          className="mt-2 w-full text-red-600 dark:text-red-400"
          onClick={() => finish(questions, answers)}
        >
          <ClipboardCheck size={14} /> پایان آزمون و مشاهدهٔ کارنامه
        </Button>
      ) : null}
    </div>
  );
}

function IntroStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div>
      <span className="mx-auto flex w-fit rounded-xl bg-background/20 p-1.5">{icon}</span>
      <strong className="mt-1 block text-base font-bold">{value}</strong>
      <span className="text-[10.5px] opacity-90">{label}</span>
    </div>
  );
}
