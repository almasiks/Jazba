import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudentView } from "@/components/student/student-view";
import { getLessonForStudent } from "@/lib/lessons";
import { getStorage } from "@/lib/server/storage";

export const metadata: Metadata = {
  title: "Материалы занятия — Jazba",
  robots: { index: false, follow: false },
};

/** Страница студента: только опубликованные материалы, без транскрипта и имён. */
export default function StudentPage({ params }: PageProps<"/s/[slug]">) {
  return (
    <main className="flex w-full flex-1 flex-col print:p-0">
      <Suspense fallback={<p className="p-6 text-center font-semibold text-muted-foreground">Загружаем материалы…</p>}>
        <Student params={params} />
      </Suspense>
    </main>
  );
}

async function Student({ params }: { params: PageProps<"/s/[slug]">["params"] }) {
  const { slug } = await params;
  const result = await getLessonForStudent(getStorage(), slug);

  if (result.status === "not-found") notFound();
  if (result.status === "unpublished") return <NotPublished />;
  return <StudentView lesson={result.lesson} />;
}

function NotPublished() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-[20px] bg-brand-soft text-brand" aria-hidden>
        <BookOpen className="size-8" strokeWidth={2.2} />
      </span>
      <h1 className="text-2xl font-black">Материалы пока не опубликованы</h1>
      <p className="max-w-sm font-semibold text-muted-foreground">
        Ментор ещё готовит материалы этого занятия. Загляните по этой ссылке чуть позже.
      </p>
    </div>
  );
}
