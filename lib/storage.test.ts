// Тесты хранилища и проверки доступа. Каждый тест — во временной папке.
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  formatDuration,
  getLessonForEditor,
  getLessonForStudent,
  publishLesson,
  unpublishLesson,
} from "./lessons.ts";
import type { Materials } from "./schema.ts";
import { isEditId, isSlug, JsonFileLessonStorage, type CreateLessonInput } from "./storage.ts";

const materials: Materials = {
  title: "Методы массивов",
  summary: [{ heading: "map", timestamp: "01:01", points: ["Возвращает новый массив"] }],
  quiz: [
    {
      question: "Что вернёт map?",
      options: ["Новый массив", "undefined", "Исходный массив", "Число"],
      correctIndex: 0,
      explanation: "map всегда возвращает новый массив.",
      timestamp: "02:01",
    },
  ],
  homework: { task: "Посчитать корзину", requirements: ["filter"], criteria: ["Без for"] },
  faq: [{ question: "А filter?", answer: "Пустой массив.", timestamp: "05:16" }],
  glossary: [{ term: "map", kk: "map", ru: "map", en: "map", definition: "Метод массива." }],
};

const input = (over: Partial<CreateLessonInput> = {}): CreateLessonInput => ({
  materials,
  transcript: "[00:01] Ментор: Привет. [00:18] Студент 1: Да.",
  recordingUrl: "https://youtu.be/dQw4w9WgXcQ",
  language: "ru",
  mock: false,
  startedAt: new Date(Date.now() - 14 * 60_000),
  ...over,
});

let dir: string;
let storage: JsonFileLessonStorage;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "jazba-lessons-"));
  storage = new JsonFileLessonStorage(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("JsonFileLessonStorage", () => {
  it("create: черновик с двумя разными ID и датами", async () => {
    const lesson = await storage.create(input());
    assert.equal(lesson.status, "draft");
    assert.ok(isEditId(lesson.editId), "editId — длинный секретный");
    assert.ok(isSlug(lesson.slug), "slug — короткий публичный");
    assert.notEqual(lesson.editId, lesson.slug);
    assert.equal(lesson.publishedAt, null);
    assert.ok(lesson.createdAt && lesson.generatedAt && lesson.startedAt);
    // файл называется по editId
    assert.deepEqual(await readdir(dir), [`${lesson.editId}.json`]);
  });

  it("get / getBySlug находят занятие только по своему ID", async () => {
    const lesson = await storage.create(input());
    assert.equal((await storage.get(lesson.editId))?.slug, lesson.slug);
    assert.equal((await storage.getBySlug(lesson.slug))?.editId, lesson.editId);
    assert.equal(await storage.get(lesson.slug), null);
    assert.equal(await storage.getBySlug(lesson.editId), null);
  });

  it("update меняет поля и updatedAt, ID не трогает", async () => {
    const lesson = await storage.create(input());
    await new Promise((r) => setTimeout(r, 5));
    const updated = await storage.update(lesson.editId, {
      materials: { ...materials, title: "Новая тема" },
      recordingUrl: null,
    });
    assert.equal(updated?.materials.title, "Новая тема");
    assert.equal(updated?.recordingUrl, null);
    assert.equal(updated?.editId, lesson.editId);
    assert.equal(updated?.slug, lesson.slug);
    assert.ok(updated!.updatedAt > lesson.updatedAt);
    assert.equal((await storage.get(lesson.editId))?.materials.title, "Новая тема");
  });

  it("update не сохраняет некорректные материалы", async () => {
    const lesson = await storage.create(input());
    await assert.rejects(storage.update(lesson.editId, { materials: { ...materials, title: "  " } }));
    assert.equal((await storage.get(lesson.editId))?.materials.title, materials.title);
  });

  it("list — новые сверху; delete удаляет", async () => {
    const a = await storage.create(input());
    await new Promise((r) => setTimeout(r, 5));
    const b = await storage.create(input());
    assert.deepEqual((await storage.list()).map((l) => l.editId), [b.editId, a.editId]);

    assert.equal(await storage.delete(a.editId), true);
    assert.equal(await storage.delete(a.editId), false);
    assert.equal(await storage.get(a.editId), null);
    assert.equal((await storage.list()).length, 1);
  });

  it("пустая или несуществующая папка — пустой список", async () => {
    assert.deepEqual(await new JsonFileLessonStorage(path.join(dir, "нет-такой")).list(), []);
  });

  it("не выходит за пределы папки: «../» и чужие имена отклоняются", async () => {
    assert.equal(await storage.get("../evil"), null);
    assert.equal(await storage.getBySlug("../evil"), null);
    assert.equal(await storage.delete("../evil"), false);
  });

  it("повреждённый файл пропускается, а не роняет список", async () => {
    await storage.create(input());
    await writeFile(path.join(dir, `${"x".repeat(32)}.json`), "{не json");
    assert.equal((await storage.list()).length, 1);
  });

  it("транскрипт хранится обезличенным — как передали", async () => {
    const lesson = await storage.create(input());
    const raw = await readFile(path.join(dir, `${lesson.editId}.json`), "utf8");
    assert.ok(raw.includes("Студент 1"));
  });
});

describe("доступ: редактор только по editId, студент только по slug", () => {
  it("slug НЕ открывает редактор", async () => {
    const lesson = await storage.create(input());
    assert.equal(await getLessonForEditor(storage, lesson.slug), null);
    assert.equal((await getLessonForEditor(storage, lesson.editId))?.editId, lesson.editId);
  });

  it("неопубликованное занятие студенту не показывается", async () => {
    const lesson = await storage.create(input());
    assert.deepEqual(await getLessonForStudent(storage, lesson.slug), { status: "unpublished" });
  });

  it("editId не открывает страницу студента; неизвестный slug — not-found", async () => {
    const lesson = await storage.create(input());
    await publishLesson(storage, lesson.editId);
    assert.deepEqual(await getLessonForStudent(storage, lesson.editId), { status: "not-found" });
    assert.deepEqual(await getLessonForStudent(storage, "zzzzzzzzzz"), { status: "not-found" });
  });

  it("студент получает только публичные поля: без транскрипта и editId", async () => {
    const lesson = await storage.create(input());
    await publishLesson(storage, lesson.editId);
    const result = await getLessonForStudent(storage, lesson.slug);
    assert.equal(result.status, "published");
    if (result.status !== "published") return;
    assert.deepEqual(Object.keys(result.lesson).sort(), ["materials", "publishedAt", "recordingUrl", "slug"]);
    const json = JSON.stringify(result.lesson);
    assert.ok(!json.includes(lesson.editId));
    assert.ok(!json.includes("Студент 1"));
    assert.deepEqual(result.lesson.materials.homework.criteria, [], "критерии — только ментору");
  });
});

describe("публикация и метрика", () => {
  it("публикация фиксирует время подготовки, снятие — возвращает в черновик", async () => {
    const started = new Date("2026-11-09T10:00:00Z");
    const lesson = await storage.create(input({ startedAt: started }));

    const published = await publishLesson(storage, lesson.editId, new Date("2026-11-09T10:14:00Z"));
    assert.equal(published?.status, "published");
    assert.equal(published?.prepDurationMs, 14 * 60_000);
    assert.equal(formatDuration(published!.prepDurationMs!), "14 мин");

    const draft = await unpublishLesson(storage, lesson.editId);
    assert.equal(draft?.status, "draft");
    assert.equal(draft?.publishedAt, null);
    assert.equal(draft?.prepDurationMs, 14 * 60_000, "метрика первой публикации сохраняется");

    // Повторная публикация не перезаписывает метрику
    const again = await publishLesson(storage, lesson.editId, new Date("2026-11-10T10:00:00Z"));
    assert.equal(again?.prepDurationMs, 14 * 60_000);
    assert.equal(again?.firstPublishedAt, "2026-11-09T10:14:00.000Z");
  });

  it("formatDuration", () => {
    assert.equal(formatDuration(20_000), "меньше минуты");
    assert.equal(formatDuration(65 * 60_000), "1 ч 5 мин");
    assert.equal(formatDuration(120 * 60_000), "2 ч");
  });
});

describe("форматы ID не пересекаются", () => {
  it("slug никогда не подходит как editId и наоборот", async () => {
    for (let i = 0; i < 20; i++) {
      const lesson = await storage.create(input());
      assert.ok(!isEditId(lesson.slug));
      assert.ok(!isSlug(lesson.editId));
    }
  });
});

// Общий контракт хранилища — тот же, что прогоняется для Supabase
import { runStorageContract } from "./storage-contract.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { after as afterAll } from "node:test";

const contractDir = mkdtempSync(path.join(tmpdir(), "jazba-contract-"));
const contractStorage = new JsonFileLessonStorage(contractDir);
afterAll(() => rmSync(contractDir, { recursive: true, force: true }));
runStorageContract("JSON-файлы", () => contractStorage);
