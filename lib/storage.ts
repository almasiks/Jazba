/**
 * Хранилище занятий.
 *
 * Остальной код работает только через интерфейс LessonStorage — позже
 * реализацию на JSON-файлах заменим на Supabase, не трогая страницы и API.
 *
 * У занятия два независимых ID:
 *  - editId — секретный, длинный, открывает редактор ментора;
 *  - slug — публичный, короткий, для ссылки студентам.
 * Файлы называются по editId, поэтому по slug редактор не открыть.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isEditId, isSlug, SLUG_LENGTH } from "./ids.ts";
import { LessonSchema, type Language, type Lesson, type Materials } from "./schema.ts";

export { isEditId, isSlug };

export type CreateLessonInput = {
  materials: Materials;
  transcript: string;
  recordingUrl: string | null;
  language: Language;
  mock: boolean;
  startedAt: Date;
  generatedAt?: Date;
  /** Активное время ментора до создания занятия (мс). */
  activePrepMs?: number | null;
};

/** Что можно менять после создания. ID и дата создания неизменны. */
export type LessonPatch = Partial<
  Pick<
    Lesson,
    "materials" | "recordingUrl" | "status" | "publishedAt" | "firstPublishedAt" | "prepDurationMs" | "activePrepMs"
  >
>;

export interface LessonStorage {
  create(input: CreateLessonInput): Promise<Lesson>;
  /** По секретному editId. */
  get(editId: string): Promise<Lesson | null>;
  /** По публичному slug. */
  getBySlug(slug: string): Promise<Lesson | null>;
  update(editId: string, patch: LessonPatch): Promise<Lesson | null>;
  /** Все занятия, новые сверху. */
  list(): Promise<Lesson[]>;
  delete(editId: string): Promise<boolean>;
  /** Удаляет несколько занятий, возвращает editId реально удалённых. */
  deleteMany(editIds: string[]): Promise<string[]>;
}

// ---------- ID ----------

export function generateEditId(): string {
  return randomBytes(24).toString("base64url");
}

export function generateSlug(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(SLUG_LENGTH);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}


// ---------- Реализация на JSON-файлах ----------

export class JsonFileLessonStorage implements LessonStorage {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private file(editId: string) {
    return path.join(this.dir, `${editId}.json`);
  }

  private async write(lesson: Lesson) {
    await mkdir(this.dir, { recursive: true });
    // Пишем во временный файл и переименовываем — чтобы не оставить полузаписанный JSON
    const tmp = `${this.file(lesson.editId)}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, JSON.stringify(lesson, null, 2), "utf8");
    await rename(tmp, this.file(lesson.editId));
  }

  private async read(file: string): Promise<Lesson | null> {
    try {
      const parsed = LessonSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (!parsed.success) {
        console.error(`[storage] Повреждённый файл занятия: ${file}`);
        return null;
      }
      return parsed.data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[storage] Не удалось прочитать ${file}:`, error);
      }
      return null;
    }
  }

  async create(input: CreateLessonInput): Promise<Lesson> {
    const now = new Date().toISOString();
    const existing = await this.list();
    const usedSlugs = new Set(existing.map((l) => l.slug));
    let slug = generateSlug();
    while (usedSlugs.has(slug)) slug = generateSlug();

    const lesson: Lesson = LessonSchema.parse({
      editId: generateEditId(),
      slug,
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

    await this.write(lesson);
    return lesson;
  }

  async get(editId: string): Promise<Lesson | null> {
    if (!isEditId(editId)) return null; // заодно защищает от «../» в пути
    return this.read(this.file(editId));
  }

  async getBySlug(slug: string): Promise<Lesson | null> {
    if (!isSlug(slug)) return null;
    // Для локальных файлов перебор достаточен; в Supabase будет индекс по slug
    return (await this.list()).find((l) => l.slug === slug) ?? null;
  }

  async update(editId: string, patch: LessonPatch): Promise<Lesson | null> {
    const current = await this.get(editId);
    if (!current) return null;
    const next = LessonSchema.parse({ ...current, ...patch, updatedAt: new Date().toISOString() });
    await this.write(next);
    return next;
  }

  async list(): Promise<Lesson[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const lessons = await Promise.all(
      names
        .filter((n) => n.endsWith(".json") && isEditId(n.slice(0, -5)))
        .map((n) => this.read(path.join(this.dir, n))),
    );
    return lessons
      .filter((l): l is Lesson => l !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(editId: string): Promise<boolean> {
    if (!isEditId(editId) || !(await this.get(editId))) return false;
    await rm(this.file(editId), { force: true });
    return true;
  }

  async deleteMany(editIds: string[]): Promise<string[]> {
    const deleted: string[] = [];
    for (const editId of new Set(editIds)) if (await this.delete(editId)) deleted.push(editId);
    return deleted;
  }
}

// Экземпляр приложения (local или supabase) — в lib/server/storage.ts
