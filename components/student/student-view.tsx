"use client";

import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { BLOCK_STYLE } from "@/components/block-style";
import { FaqTab } from "@/components/materials/faq-tab";
import { GlossaryTab } from "@/components/materials/glossary-tab";
import { HomeworkTab } from "@/components/materials/homework-tab";
import { QuizTab } from "@/components/materials/quiz-tab";
import { SummaryTab } from "@/components/materials/summary-tab";
import { PrintableMaterials } from "@/components/print/printable-materials";
import { RecordingProvider } from "@/components/recording-context";
import { BLOCK_KEYS, BLOCK_LABELS, type BlockKey, type PublicLesson } from "@/lib/schema";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Almaty" });

/** Материалы для студента: фиолетовая шапка, вкладки-«таблетки», тест по одному вопросу, PDF. */
export function StudentView({ lesson }: { lesson: PublicLesson }) {
  const { materials } = lesson;
  const [tab, setTab] = useState<BlockKey>("summary");

  const content: Record<BlockKey, React.ReactNode> = {
    summary: <SummaryTab sections={materials.summary} />,
    quiz: <QuizTab questions={materials.quiz} sections={materials.summary} />,
    homework: <HomeworkTab homework={materials.homework} />,
    faq: <FaqTab items={materials.faq} />,
    glossary: <GlossaryTab items={materials.glossary} />,
  };

  return (
    <RecordingProvider value={lesson.recordingUrl}>
      <div className="flex flex-1 flex-col print:hidden">
        <header className="bg-brand text-white">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5 px-5 pt-6 pb-5">
            <span className="text-[13px] font-extrabold text-brand-tint">
              Занятие{lesson.publishedAt && ` · ${dateFormat.format(new Date(lesson.publishedAt))}`}
            </span>
            <h1 className="text-[22px] leading-tight font-black sm:text-[28px]">{materials.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {lesson.recordingUrl && (
                <a
                  href={lesson.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-extrabold text-white no-underline hover:bg-white/25 hover:text-white"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Запись занятия
                </a>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-extrabold hover:bg-white/25"
              >
                <Download className="size-4" aria-hidden />
                Скачать PDF
              </button>
            </div>
          </div>
        </header>

        <nav aria-label="Материалы" className="sticky top-0 z-10 border-b-2 border-border bg-card">
          <div role="tablist" className="mx-auto flex w-full max-w-2xl gap-2 overflow-x-auto px-4 py-3">
            {BLOCK_KEYS.map((block) => {
              const active = block === tab;
              const count = block === "quiz" ? materials.quiz.length : null;
              return (
                <button
                  key={block}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(block)}
                  className={cn(
                    "min-h-10 shrink-0 rounded-full border-2 border-border bg-card px-3.5 text-sm font-extrabold text-muted-foreground transition-colors hover:bg-surface-soft",
                    active && cn("font-black", BLOCK_STYLE[block].solid),
                  )}
                >
                  {BLOCK_LABELS[block]}
                  {count !== null && ` · ${count}`}
                </button>
              );
            })}
          </div>
        </nav>

        <div role="tabpanel" aria-label={BLOCK_LABELS[tab]} className="mx-auto w-full max-w-2xl px-4 pt-5 pb-8">
          {content[tab]}
        </div>
      </div>

      <PrintableMaterials materials={materials} variant="student" recordingUrl={lesson.recordingUrl} />
    </RecordingProvider>
  );
}
