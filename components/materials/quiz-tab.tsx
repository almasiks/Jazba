"use client";

import { RotateCcw, Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { looksLikeCode } from "@/lib/looks-like-code";
import { reviewTopics } from "@/lib/review";
import type { QuizQuestion, SummarySection } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { TimestampLink } from "./timestamp-link";

const LETTERS = ["A", "B", "C", "D"];

/**
 * Тест студента — по одному вопросу, с прогрессом. Правильный ответ не виден, пока студент не ответил;
 * после ответа — объяснение, при ошибке — «Пересмотри с мм:сс». В конце — итог и темы для повторения.
 * В счёт идёт первый ответ на каждый вопрос.
 */
export function QuizTab({ questions, sections = [] }: { questions: QuizQuestion[]; sections?: SummarySection[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [index, setIndex] = useState(0);

  if (questions.length === 0) return <EmptyState>Вопросов для теста нет.</EmptyState>;

  const reset = () => {
    setAnswers(questions.map(() => null));
    setIndex(0);
  };

  if (index >= questions.length) {
    const correct = answers.filter((a, i) => a === questions[i].correctIndex).length;
    return (
      <QuizResult correct={correct} total={questions.length} topics={reviewTopics(questions, answers, sections)} onReset={reset} />
    );
  }

  const q = questions[index];
  const picked = answers[index];
  const answered = picked !== null;
  const isRight = answered && picked === q.correctIndex;
  const isLast = index === questions.length - 1;
  const progress = ((index + (answered ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          className="h-3.5 flex-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label="Прогресс теста"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={index + (answered ? 1 : 0)}
        >
          <div className="h-full rounded-full bg-quiz transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm font-black text-muted-foreground tabular-nums">
          {index + 1} / {questions.length}
        </span>
      </div>

      <h2 className="text-[21px] leading-tight font-black whitespace-pre-wrap">{q.question}</h2>

      <div className="flex flex-col gap-2.5">
        {q.options.map((option, j) => {
          const right = answered && j === q.correctIndex;
          const wrong = answered && j === picked && !right;
          return (
            <button
              key={j}
              type="button"
              disabled={answered}
              onClick={() => setAnswers((prev) => prev.map((a, k) => (k === index ? j : a)))}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-2.5 text-left shadow-[0_4px_0_var(--border)] transition-colors",
                !answered && "hover:bg-surface-soft active:translate-y-[2px] active:shadow-none",
                right && "border-ok bg-ok-soft shadow-[0_4px_0_var(--color-ok)]",
                wrong && "border-bad bg-bad-soft shadow-[0_4px_0_var(--color-bad)]",
                answered && !right && !wrong && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-[10px] bg-track text-sm font-black text-muted-foreground",
                  right && "bg-ok text-white",
                  wrong && "bg-bad text-white",
                )}
              >
                {LETTERS[j]}
              </span>
              <span className={cn("min-w-0 flex-1 font-bold whitespace-pre-wrap", looksLikeCode(option) && "font-mono text-sm")}>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {answered &&
        (isRight ? (
          <div aria-live="polite" className="flex flex-col gap-1.5 rounded-[18px] border-2 border-ok-line bg-ok-soft p-4">
            <span className="text-lg font-black text-ok-ink">Верно!</span>
            <p className="leading-relaxed font-semibold text-[#22543d] whitespace-pre-wrap">{q.explanation}</p>
          </div>
        ) : (
          <div aria-live="polite" className="flex flex-col gap-2.5 rounded-[18px] border-2 border-bad-line bg-bad-soft p-4">
            <span className="text-lg font-black text-bad-ink">Не совсем</span>
            <p className="leading-relaxed font-semibold text-[#5c1a1d] whitespace-pre-wrap">{q.explanation}</p>
            <TimestampLink value={q.timestamp} prefix="Пересмотри с" variant="button" />
          </div>
        ))}

      {/* Нижняя панель с главной кнопкой — прилипает к низу экрана на телефоне */}
      <div className="sticky bottom-0 -mx-4 mt-2 border-t-2 border-border bg-card px-4 pt-3.5 pb-5">
        {!answered ? (
          <Button disabled size="xl" className="w-full bg-border text-muted-foreground shadow-none disabled:opacity-100">
            Выбери ответ
          </Button>
        ) : (
          <Button size="xl" variant={isRight ? "success" : "default"} className="w-full" onClick={() => setIndex((i) => i + 1)}>
            {isLast ? "Показать результат" : "Дальше"}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuizResult({
  correct,
  total,
  topics,
  onReset,
}: {
  correct: number;
  total: number;
  topics: ReturnType<typeof reviewTopics>;
  onReset: () => void;
}) {
  const perfect = correct === total;
  return (
    <div aria-live="polite" className="flex flex-col gap-4 rounded-[22px] border-2 border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-sun" aria-hidden>
          <Trophy className="size-6" strokeWidth={2.2} />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-extrabold text-muted-foreground">Результат</span>
          <span className="text-2xl font-black">
            {correct} из {total}
          </span>
        </div>
      </div>
      {perfect ? (
        <p className="font-semibold">Отлично — все ответы верные! Тема занятия усвоена.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="font-black">Стоит пересмотреть:</p>
          <ul className="flex flex-col gap-2">
            {topics.map((topic, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 font-semibold">
                <span>• {topic.title}</span>
                <TimestampLink value={topic.timestamp} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="outline" onClick={onReset} className="w-fit">
        <RotateCcw data-icon="inline-start" />
        Пройти ещё раз
      </Button>
    </div>
  );
}
