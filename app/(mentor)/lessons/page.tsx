import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LessonsBoard, type LessonRow } from "@/components/lessons/lessons-board";
import { buttonVariants } from "@/components/ui/button";
import type { Lesson } from "@/lib/schema";
import { isMentor } from "@/lib/server/guard";
import { getStorage } from "@/lib/server/storage";
import { extractTimecodes } from "@/lib/timecode";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Мои занятия — Jazba" };

export default function LessonsPage() {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] leading-tight font-black tracking-tight sm:text-[40px]">Мои занятия</h1>
          <p className="text-lg text-muted-foreground">Черновики и опубликованные материалы</p>
        </div>
        <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-[52px] rounded-2xl px-[22px] text-[17px] font-black")}>
          <Plus data-icon="inline-start" strokeWidth={2.6} />
          Новое занятие
        </Link>
      </header>
      <Suspense fallback={<p className="font-semibold text-muted-foreground">Загружаем занятия…</p>}>
        <LessonList />
      </Suspense>
    </>
  );
}

/** В браузер отдаём только поля для списка — без материалов и транскрипта. */
function toRow(lesson: Lesson): LessonRow {
  return {
    editId: lesson.editId,
    title: lesson.materials.title,
    createdAt: lesson.createdAt,
    status: lesson.status,
    mock: lesson.mock,
    firstPublishedAt: lesson.firstPublishedAt,
    activePrepMs: lesson.activePrepMs,
    prepDurationMs: lesson.prepDurationMs,
    // Длина записи — по последнему таймкоду транскрипта (если таймкоды есть)
    recordingLength: extractTimecodes(lesson.transcript).at(-1)?.label ?? null,
  };
}

async function LessonList() {
  await connection(); // список читается из хранилища при каждом запросе
  if (!(await isMentor())) redirect("/login?next=/lessons"); // вторая линия защиты после proxy.ts
  const lessons = await getStorage().list();
  return <LessonsBoard initialLessons={lessons.map(toRow)} />;
}
