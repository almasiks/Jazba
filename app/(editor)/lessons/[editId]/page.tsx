import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isMentor } from "@/lib/server/guard";
import { Suspense } from "react";
import { LessonEditor, type EditorLesson } from "@/components/editor/lesson-editor";
import { getLessonForEditor } from "@/lib/lessons";
import type { Lesson } from "@/lib/schema";
import { getStorage } from "@/lib/server/storage";

export const metadata: Metadata = { title: "Редактор занятия — Jazba" };

/** Редактор ментора. Открывается только по секретному editId — slug сюда не подходит. */
export default function EditorPage({ params }: PageProps<"/lessons/[editId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загружаем занятие…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/lessons/[editId]">["params"] }) {
  const { editId } = await params;
  if (!(await isMentor())) redirect(`/login?next=/lessons/${editId}`); // вторая линия защиты после proxy.ts
  const lesson = await getLessonForEditor(getStorage(), editId);
  if (!lesson) notFound();

  return <LessonEditor lesson={toEditorLesson(lesson)} />;
}

/** Транскрипт в браузер не отправляем — он нужен только серверу для перегенерации. */
function toEditorLesson(lesson: Lesson): EditorLesson {
  const editorLesson: Partial<Lesson> = { ...lesson };
  delete editorLesson.transcript;
  return editorLesson as EditorLesson;
}
