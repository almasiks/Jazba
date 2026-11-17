/**
 * Доступ к занятиям для ментора и студентов + действия над занятием.
 * Работает только через интерфейс LessonStorage.
 */
import { MAX_ACTIVITY_CHUNK_MS, sanitizeActiveMs } from "./active-time.ts";
import type { Lesson, Materials, PublicLesson } from "./schema.ts";
import type { LessonStorage } from "./storage.ts";

/** Редактор открывается ТОЛЬКО по секретному editId. Slug сюда не подходит. */
export async function getLessonForEditor(storage: LessonStorage, editId: string): Promise<Lesson | null> {
  return storage.get(editId);
}

export type StudentLessonResult =
  | { status: "not-found" }
  | { status: "unpublished" }
  | { status: "published"; lesson: PublicLesson };

/** Страница студента: только опубликованное и только публичные поля. */
export async function getLessonForStudent(
  storage: LessonStorage,
  slug: string,
): Promise<StudentLessonResult> {
  const lesson = await storage.getBySlug(slug);
  if (!lesson) return { status: "not-found" };
  if (lesson.status !== "published") return { status: "unpublished" };
  return { status: "published", lesson: toPublicLesson(lesson) };
}

/**
 * Убирает всё, что студенту видеть нельзя: транскрипт, editId, служебные даты
 * и критерии проверки домашки (они только для ментора).
 */
export function toPublicLesson(lesson: Lesson): PublicLesson {
  return {
    slug: lesson.slug,
    materials: { ...lesson.materials, homework: { ...lesson.materials.homework, criteria: [] } },
    recordingUrl: lesson.recordingUrl,
    publishedAt: lesson.publishedAt,
  };
}

/**
 * Публикация. Метрика «подготовлено за N мин» фиксируется при первой публикации.
 * activeMs — активное время из редактора, ещё не отправленное на сервер.
 */
export async function publishLesson(storage: LessonStorage, editId: string, now = new Date(), activeMs = 0) {
  const lesson = await storage.get(editId);
  if (!lesson) return null;
  const iso = now.toISOString();
  const first = lesson.firstPublishedAt === null;
  return storage.update(editId, {
    status: "published",
    publishedAt: iso,
    firstPublishedAt: lesson.firstPublishedAt ?? iso,
    prepDurationMs:
      lesson.prepDurationMs ?? Math.max(0, now.getTime() - new Date(lesson.startedAt).getTime()),
    ...(first && lesson.activePrepMs !== null
      ? { activePrepMs: lesson.activePrepMs + sanitizeActiveMs(activeMs, MAX_ACTIVITY_CHUNK_MS) }
      : {}),
  });
}

/**
 * Добавляет активное время из редактора. После первой публикации метрика заморожена,
 * а у старых занятий (activePrepMs = null) активное время не считалось — их не трогаем.
 */
export async function addActiveTime(storage: LessonStorage, editId: string, ms: unknown) {
  const lesson = await storage.get(editId);
  if (!lesson) return null;
  const add = sanitizeActiveMs(ms, MAX_ACTIVITY_CHUNK_MS);
  if (add === 0 || lesson.firstPublishedAt !== null || lesson.activePrepMs === null) return lesson;
  return storage.update(editId, { activePrepMs: lesson.activePrepMs + add });
}

/**
 * Время подготовки для показа: активное, если оно есть, иначе старое «по часам».
 * До первой публикации подготовка не закончена — null.
 */
export function prepTimeMs(lesson: Pick<Lesson, "firstPublishedAt" | "activePrepMs" | "prepDurationMs">): number | null {
  if (lesson.firstPublishedAt === null) return null;
  return lesson.activePrepMs ?? lesson.prepDurationMs;
}

export type LessonStats = { count: number; published: number; averagePrepMs: number | null };

/** Плитки статистики. Демо-занятия (созданы без ИИ) не учитываются. */
export function lessonStats(
  lessons: Pick<Lesson, "mock" | "status" | "firstPublishedAt" | "activePrepMs" | "prepDurationMs">[],
): LessonStats {
  const real = lessons.filter((l) => !l.mock);
  const times = real.map(prepTimeMs).filter((t): t is number => t !== null);
  return {
    count: real.length,
    published: real.filter((l) => l.status === "published").length,
    averagePrepMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
  };
}

export async function unpublishLesson(storage: LessonStorage, editId: string) {
  return storage.update(editId, { status: "draft", publishedAt: null });
}

export async function saveLessonContent(
  storage: LessonStorage,
  editId: string,
  content: { materials: Materials; recordingUrl: string | null },
) {
  return storage.update(editId, content);
}

/** «14 мин», «меньше минуты», «1 ч 5 мин». */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "меньше минуты";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}
