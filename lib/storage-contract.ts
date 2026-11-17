/**
 * Общий набор проверок для любой реализации LessonStorage («контракт»).
 * Запускается из тестов для JSON-файлов и (если заданы ключи) для Supabase.
 * Не *.test.ts — сам по себе не запускается.
 */
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { getLessonForEditor, getLessonForStudent, publishLesson, unpublishLesson } from "./lessons.ts";
import type { Materials } from "./schema.ts";
import { isEditId, isSlug, type CreateLessonInput, type LessonStorage } from "./storage.ts";

export const sampleMaterials: Materials = {
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

export const sampleInput = (over: Partial<CreateLessonInput> = {}): CreateLessonInput => ({
  materials: sampleMaterials,
  transcript: "[00:01] Ментор: Привет. [00:18] Студент 1: Да.",
  recordingUrl: "https://youtu.be/dQw4w9WgXcQ",
  language: "ru",
  mock: false,
  startedAt: new Date(Date.now() - 14 * 60_000),
  ...over,
});

export function runStorageContract(name: string, getStorage: () => LessonStorage) {
  describe(`LessonStorage: ${name}`, () => {
    const created: string[] = [];
    const create = async (over?: Partial<CreateLessonInput>) => {
      const lesson = await getStorage().create(sampleInput(over));
      created.push(lesson.editId);
      return lesson;
    };
    // Убираем за собой (важно для общей тестовой базы Supabase)
    after(async () => {
      for (const id of created) await getStorage().delete(id).catch(() => {});
    });

    it("create → черновик с двумя разными ID", async () => {
      const lesson = await create();
      assert.equal(lesson.status, "draft");
      assert.ok(isEditId(lesson.editId) && isSlug(lesson.slug));
      assert.deepEqual(lesson.materials, sampleMaterials);
      assert.equal(lesson.prepDurationMs, null);
    });

    it("get и getBySlug возвращают то же самое; ID не взаимозаменяемы", async () => {
      const lesson = await create();
      const storage = getStorage();
      assert.deepEqual(await storage.get(lesson.editId), lesson);
      assert.deepEqual(await storage.getBySlug(lesson.slug), lesson);
      assert.equal(await storage.get(lesson.slug), null);
      assert.equal(await storage.getBySlug(lesson.editId), null);
      assert.equal(await storage.get("../../etc/passwd"), null);
    });

    it("update сохраняет изменения, ID и дату создания не трогает", async () => {
      const lesson = await create();
      await new Promise((r) => setTimeout(r, 10));
      const updated = await getStorage().update(lesson.editId, {
        materials: { ...sampleMaterials, title: "Новая тема" },
        recordingUrl: null,
      });
      assert.equal(updated?.materials.title, "Новая тема");
      assert.equal(updated?.createdAt, lesson.createdAt);
      assert.ok(updated!.updatedAt > lesson.updatedAt);
      const reread = await getStorage().get(lesson.editId);
      assert.equal(reread?.materials.title, "Новая тема");
      assert.equal(reread?.recordingUrl, null);
      assert.equal(reread?.slug, lesson.slug);
      assert.equal(await getStorage().update("x".repeat(32), { recordingUrl: null }), null);
    });

    it("list — новые сверху; delete удаляет", async () => {
      const a = await create();
      await new Promise((r) => setTimeout(r, 10));
      const b = await create();
      const ids = (await getStorage().list()).map((l) => l.editId).filter((id) => id === a.editId || id === b.editId);
      assert.deepEqual(ids, [b.editId, a.editId]);
      assert.equal(await getStorage().delete(a.editId), true);
      assert.equal(await getStorage().delete(a.editId), false);
      assert.equal(await getStorage().get(a.editId), null);
    });

    it("доступ: slug не открывает редактор; студенту — только опубликованное", async () => {
      const lesson = await create();
      const storage = getStorage();
      assert.equal(await getLessonForEditor(storage, lesson.slug), null);
      assert.deepEqual(await getLessonForStudent(storage, lesson.slug), { status: "unpublished" });

      const started = new Date(lesson.startedAt).getTime();
      const published = await publishLesson(storage, lesson.editId, new Date(started + 14 * 60_000));
      assert.equal(published?.prepDurationMs, 14 * 60_000);
      const result = await getLessonForStudent(storage, lesson.slug);
      assert.equal(result.status, "published");
      if (result.status === "published") {
        assert.ok(!JSON.stringify(result.lesson).includes("Студент 1"));
        assert.deepEqual(result.lesson.materials.homework.criteria, []);
      }
      assert.deepEqual(await getLessonForStudent(storage, lesson.editId), { status: "not-found" });

      const draft = await unpublishLesson(storage, lesson.editId);
      assert.equal(draft?.status, "draft");
      assert.equal((await storage.get(lesson.editId))?.prepDurationMs, 14 * 60_000);
    });

    it("deleteMany удаляет только переданные и возвращает реально удалённые", async () => {
      const storage = getStorage();
      const [a, b, keep] = [await create(), await create(), await create()];
      const missing = "Z".repeat(32);
      const deleted = await storage.deleteMany([a.editId, b.editId, missing, a.editId, "../evil"]);
      assert.deepEqual([...deleted].sort(), [a.editId, b.editId].sort());
      assert.equal(await storage.get(a.editId), null);
      assert.equal(await storage.get(b.editId), null);
      assert.ok(await storage.get(keep.editId), "остальные занятия на месте");
      assert.deepEqual(await storage.deleteMany([]), []);
    });

    it("activePrepMs сохраняется при создании и обновлении", async () => {
      const lesson = await create({ activePrepMs: 90_000 });
      assert.equal(lesson.activePrepMs, 90_000);
      const updated = await getStorage().update(lesson.editId, { activePrepMs: 120_000 });
      assert.equal(updated?.activePrepMs, 120_000);
      assert.equal((await getStorage().get(lesson.editId))?.activePrepMs, 120_000);
      assert.equal((await create()).activePrepMs, null, "без значения — null");
    });
  });
}
