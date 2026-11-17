/**
 * Хранилище занятий в Supabase (таблица public.lessons, см. supabase/migrations/).
 *
 * Клиент создаётся с ключом service role и используется ТОЛЬКО на сервере
 * (см. lib/server/storage.ts — там стоит import "server-only").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEditId, generateSlug, type CreateLessonInput, type LessonPatch, type LessonStorage } from "./storage.ts";
import { isEditId, isSlug } from "./ids.ts";
import { LessonSchema, type Lesson } from "./schema.ts";

export const LESSONS_TABLE = "lessons";

/** Строка таблицы lessons (snake_case, как в SQL). */
export type LessonRow = {
  edit_id: string;
  slug: string;
  status: string;
  materials: unknown;
  transcript: string;
  recording_url: string | null;
  language: string;
  mock: boolean;
  started_at: string;
  created_at: string;
  generated_at: string;
  updated_at: string;
  published_at: string | null;
  first_published_at: string | null;
  prep_duration_ms: number | string | null;
  active_prep_ms: number | string | null;
};

// Postgres отдаёт даты как "2026-11-09T13:06:17.968+00:00" — приводим к ISO "…Z"
const iso = (value: string) => new Date(value).toISOString();
const isoOrNull = (value: string | null) => (value ? iso(value) : null);

export function lessonToRow(lesson: Lesson): LessonRow {
  return {
    edit_id: lesson.editId,
    slug: lesson.slug,
    status: lesson.status,
    materials: lesson.materials,
    transcript: lesson.transcript,
    recording_url: lesson.recordingUrl,
    language: lesson.language,
    mock: lesson.mock,
    started_at: lesson.startedAt,
    created_at: lesson.createdAt,
    generated_at: lesson.generatedAt,
    updated_at: lesson.updatedAt,
    published_at: lesson.publishedAt,
    first_published_at: lesson.firstPublishedAt,
    prep_duration_ms: lesson.prepDurationMs,
    active_prep_ms: lesson.activePrepMs,
  };
}

/** Строка из базы → проверенное zod занятие (или null, если данные повреждены). */
export function rowToLesson(row: LessonRow): Lesson | null {
  const parsed = LessonSchema.safeParse({
    editId: row.edit_id,
    slug: row.slug,
    status: row.status,
    materials: row.materials,
    transcript: row.transcript,
    recordingUrl: row.recording_url,
    language: row.language,
    mock: row.mock,
    startedAt: iso(row.started_at),
    createdAt: iso(row.created_at),
    generatedAt: iso(row.generated_at),
    updatedAt: iso(row.updated_at),
    publishedAt: isoOrNull(row.published_at),
    firstPublishedAt: isoOrNull(row.first_published_at),
    prepDurationMs: row.prep_duration_ms === null ? null : Number(row.prep_duration_ms),
    activePrepMs: row.active_prep_ms == null ? null : Number(row.active_prep_ms),
  });
  if (!parsed.success) {
    console.error(`[storage] Повреждённая запись занятия ${row.edit_id}`);
    return null;
  }
  return parsed.data;
}

export class SupabaseStorageError extends Error {}

const UNIQUE_VIOLATION = "23505";

export class SupabaseLessonStorage implements LessonStorage {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  private fail(action: string, error: { message: string }): never {
    console.error(`[storage] Supabase: ${action}:`, error.message);
    throw new SupabaseStorageError(`Не удалось ${action}: ошибка базы данных.`);
  }

  async create(input: CreateLessonInput): Promise<Lesson> {
    const now = new Date().toISOString();
    // slug уникален в базе; при редком совпадении пробуем ещё раз
    for (let attempt = 0; attempt < 5; attempt++) {
      const lesson = LessonSchema.parse({
        editId: generateEditId(),
        slug: generateSlug(),
        status: "draft",
        materials: input.materials,
        transcript: input.transcript,
        recordingUrl: input.recordingUrl,
        language: input.language,
        mock: input.mock,
        startedAt: input.startedAt.toISOString(),
        createdAt: now,
        generatedAt: (input.generatedAt ?? new Date()).toISOString(),
        updatedAt: now,
        publishedAt: null,
        firstPublishedAt: null,
        prepDurationMs: null,
        activePrepMs: input.activePrepMs ?? null,
      } satisfies Lesson);

      const { error } = await this.db.from(LESSONS_TABLE).insert(lessonToRow(lesson));
      if (!error) return lesson;
      if (error.code !== UNIQUE_VIOLATION) this.fail("сохранить занятие", error);
    }
    throw new SupabaseStorageError("Не удалось подобрать уникальную ссылку для занятия.");
  }

  private async findOne(column: "edit_id" | "slug", value: string): Promise<Lesson | null> {
    const { data, error } = await this.db.from(LESSONS_TABLE).select("*").eq(column, value).maybeSingle();
    if (error) this.fail("прочитать занятие", error);
    return data ? rowToLesson(data as LessonRow) : null;
  }

  async get(editId: string): Promise<Lesson | null> {
    if (!isEditId(editId)) return null;
    return this.findOne("edit_id", editId);
  }

  async getBySlug(slug: string): Promise<Lesson | null> {
    if (!isSlug(slug)) return null;
    return this.findOne("slug", slug);
  }

  async update(editId: string, patch: LessonPatch): Promise<Lesson | null> {
    const current = await this.get(editId);
    if (!current) return null;
    const next = LessonSchema.parse({ ...current, ...patch, updatedAt: new Date().toISOString() });
    // ID и дату создания не трогаем
    const changes: Partial<LessonRow> = lessonToRow(next);
    delete changes.edit_id;
    delete changes.slug;
    delete changes.created_at;
    const { error } = await this.db.from(LESSONS_TABLE).update(changes).eq("edit_id", editId);
    if (error) this.fail("сохранить изменения", error);
    return next;
  }

  async list(): Promise<Lesson[]> {
    const { data, error } = await this.db
      .from(LESSONS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) this.fail("загрузить список занятий", error);
    return (data as LessonRow[]).map(rowToLesson).filter((l): l is Lesson => l !== null);
  }

  async delete(editId: string): Promise<boolean> {
    if (!isEditId(editId)) return false;
    const { data, error } = await this.db.from(LESSONS_TABLE).delete().eq("edit_id", editId).select("edit_id");
    if (error) this.fail("удалить занятие", error);
    return (data?.length ?? 0) > 0;
  }

  async deleteMany(editIds: string[]): Promise<string[]> {
    const ids = [...new Set(editIds)].filter(isEditId);
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from(LESSONS_TABLE).delete().in("edit_id", ids).select("edit_id");
    if (error) this.fail("удалить занятия", error);
    return (data ?? []).map((row) => (row as { edit_id: string }).edit_id);
  }
}
