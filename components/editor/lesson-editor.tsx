"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { DemoBadge } from "@/components/demo-badge";
import { PrintableMaterials, type PrintVariant } from "@/components/print/printable-materials";
import { useActiveTime, type ActiveTime } from "@/components/use-active-time";
import { formatDuration, prepTimeMs } from "@/lib/lessons";
import type { BlockKey, Lesson, Materials } from "@/lib/schema";
import { BLOCK_LABELS } from "@/lib/schema";
import { BlockPanel } from "./block-panel";
import { FaqEditor, GlossaryEditor, HomeworkEditor, QuizEditor, SummaryEditor } from "./block-editors";
import { EditorHeader, type PublishState } from "./editor-header";
import { BlockNav, DeleteLesson, RecordingCard, StudentLinkCard } from "./editor-sidebar";
import { useAutosave } from "./use-autosave";

/** Что получает редактор: всё занятие, кроме транскрипта (он нужен только серверу). */
export type EditorLesson = Omit<Lesson, "transcript">;

const BLOCK_HINTS: Record<BlockKey, string> = {
  summary: "Разделы в порядке занятия. Таймкод — момент записи, где начинается раздел.",
  quiz: "Отметьте верный вариант. Таймкод — где объяснялась тема: после ошибки студент увидит «Пересмотри с …».",
  homework: "Требования видят студенты, критерии проверки — только вы и PDF для ментора.",
  faq: "Вопросы студентов с занятия и ваши ответы. Таймкод — где прозвучал вопрос.",
  glossary: "Термины занятия на трёх языках.",
};

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}

export function LessonEditor({ lesson }: { lesson: EditorLesson }) {
  const [materials, setMaterials] = useState<Materials>(lesson.materials);
  const [recordingUrl, setRecordingUrl] = useState(lesson.recordingUrl ?? "");
  const [publish, setPublish] = useState<PublishState>({
    status: lesson.status,
    publishedAt: lesson.publishedAt,
    firstPublishedAt: lesson.firstPublishedAt,
    prepDurationMs: lesson.prepDurationMs,
    activePrepMs: lesson.activePrepMs,
  });
  // Активное время копим до первой публикации (у старых занятий без учёта — не копим)
  const activeTime = useActiveTime(publish.firstPublishedAt === null && lesson.activePrepMs !== null);
  useActivityFlush(lesson.editId, activeTime);
  const prepTime = prepTimeMs(publish);
  const [activeBlock, setActiveBlock] = useState<BlockKey>("summary");
  const [regenerating, setRegenerating] = useState<BlockKey | null>(null);
  const [regenErrors, setRegenErrors] = useState<Partial<Record<BlockKey, string>>>({});
  const [printVariant, setPrintVariant] = useState<PrintVariant>("mentor");
  const [actionError, setActionError] = useState<string | null>(null);

  const content = useMemo(
    () => ({ materials, recordingUrl: recordingUrl.trim() || null }),
    [materials, recordingUrl],
  );
  const save = useAutosave(lesson.editId, content);

  function setBlock<K extends BlockKey>(block: K, value: Materials[K]) {
    setMaterials((m) => ({ ...m, [block]: value }));
  }

  async function regenerate(block: BlockKey) {
    setRegenerating(block);
    setRegenErrors((e) => ({ ...e, [block]: undefined }));
    try {
      const res = await fetch(`/api/lessons/${lesson.editId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setBlock(block, data.value); // сохранит автосохранение
      } else {
        setRegenErrors((e) => ({ ...e, [block]: data?.error ?? `Ошибка (код ${res.status}).` }));
      }
    } catch {
      setRegenErrors((e) => ({ ...e, [block]: "Нет связи с сервером." }));
    } finally {
      setRegenerating(null);
    }
  }

  function print(variant: PrintVariant) {
    flushSync(() => setPrintVariant(variant)); // сначала отрисовать нужную версию
    window.print();
  }

  const counts: Record<BlockKey, number> = {
    summary: materials.summary.length,
    quiz: materials.quiz.length,
    homework: 1,
    faq: materials.faq.length,
    glossary: materials.glossary.length,
  };
  const countLabels: Record<BlockKey, string> = {
    summary: plural(counts.summary, "раздел", "раздела", "разделов"),
    quiz: plural(counts.quiz, "вопрос", "вопроса", "вопросов"),
    homework: "1 задание",
    faq: plural(counts.faq, "вопрос", "вопроса", "вопросов"),
    glossary: plural(counts.glossary, "термин", "термина", "терминов"),
  };

  const editors: Record<BlockKey, React.ReactNode> = {
    summary: <SummaryEditor value={materials.summary} onChange={(v) => setBlock("summary", v)} />,
    quiz: <QuizEditor value={materials.quiz} onChange={(v) => setBlock("quiz", v)} />,
    homework: <HomeworkEditor value={materials.homework} onChange={(v) => setBlock("homework", v)} />,
    faq: <FaqEditor value={materials.faq} onChange={(v) => setBlock("faq", v)} />,
    glossary: <GlossaryEditor value={materials.glossary} onChange={(v) => setBlock("glossary", v)} />,
  };

  return (
    <>
      <div className="flex flex-1 flex-col print:hidden">
        <EditorHeader
          lesson={lesson}
          title={materials.title}
          onTitleChange={(title) => setMaterials((m) => ({ ...m, title }))}
          publish={publish}
          onPublishChange={setPublish}
          save={save}
          onPrint={print}
          onError={setActionError}
          activeTime={activeTime}
        />

        <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 pt-7 pb-16">
          {actionError && <p className="font-bold text-destructive" role="alert">{actionError}</p>}

          {save.status === "invalid" && save.issues.length > 0 && (
            <div className="rounded-[20px] border-2 border-bad-line bg-bad-soft p-4" role="alert">
              <p className="mb-1 font-black text-bad-ink">Не сохранено — исправьте ошибки:</p>
              <ul className="list-disc pl-5 font-semibold text-bad-ink">
                {save.issues.slice(0, 6).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
                {save.issues.length > 6 && <li>и ещё {save.issues.length - 6}…</li>}
              </ul>
            </div>
          )}

          {prepTime !== null && (
            <div className="flex flex-wrap items-center gap-4 rounded-[20px] bg-sun px-5 py-4 shadow-[0_5px_0_var(--color-sun-dark)]">
              <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-card" aria-hidden>
                <Clock3 className="size-6" strokeWidth={2.2} />
              </span>
              <div className="flex min-w-0 flex-[1_1_260px] flex-col">
                <span className="text-xl font-black">Материалы подготовлены за {formatDuration(prepTime)}</span>
                <span className="font-bold text-[#3d2c00]">
                  {publish.activePrepMs !== null
                    ? "Активное время от загрузки транскрипта до публикации"
                    : "Время от загрузки транскрипта до публикации"}
                </span>
              </div>
            </div>
          )}

          {lesson.mock && <DemoBadge />}

          <div className="flex flex-wrap items-start gap-6">
            <aside className="flex min-w-0 flex-[1_1_240px] flex-col gap-5">
              <BlockNav active={activeBlock} counts={counts} onSelect={setActiveBlock} />
              <RecordingCard value={recordingUrl} onChange={setRecordingUrl} />
              <StudentLinkCard slug={lesson.slug} status={publish.status} />
              <DeleteLesson editId={lesson.editId} />
            </aside>

            <div className="min-w-0 flex-[999_1_560px]">
              <BlockPanel
                key={activeBlock}
                label={BLOCK_LABELS[activeBlock]}
                countLabel={countLabels[activeBlock]}
                hint={BLOCK_HINTS[activeBlock]}
                studentPath={`/s/${lesson.slug}`}
                regenerating={regenerating === activeBlock}
                disabled={regenerating !== null}
                error={regenErrors[activeBlock]}
                onRegenerate={() => regenerate(activeBlock)}
              >
                {editors[activeBlock]}
              </BlockPanel>
            </div>
          </div>
        </main>
      </div>

      <PrintableMaterials materials={materials} variant={printVariant} recordingUrl={content.recordingUrl} />
    </>
  );
}

const FLUSH_INTERVAL_MS = 30_000;

/**
 * Отправляет накопленное активное время на сервер каждые 30 секунд и при уходе со страницы.
 * Если отправка не удалась — время возвращается в счётчик и уйдёт в следующий раз.
 */
function useActivityFlush(editId: string, activeTime: ActiveTime) {
  useEffect(() => {
    const flush = (keepalive = false) => {
      const ms = activeTime.take();
      if (ms <= 0) return;
      fetch(`/api/lessons/${editId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ms }),
        keepalive,
      })
        .then((res) => {
          if (!res.ok) activeTime.restore(ms);
        })
        .catch(() => activeTime.restore(ms));
    };
    const timer = window.setInterval(() => flush(), FLUSH_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true); // уход из редактора внутри приложения
    };
  }, [editId, activeTime]);
}
