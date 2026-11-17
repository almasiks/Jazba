// SupabaseLessonStorage: преобразование строк таблицы и (по желанию) интеграционный контракт.
//
// Интеграционные тесты идут только если заданы SUPABASE_TEST_URL и SUPABASE_TEST_SERVICE_ROLE_KEY
// (отдельный тестовый проект Supabase с применённой миграцией!). Иначе — пропускаются.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Lesson } from "./schema.ts";
import { runStorageContract, sampleMaterials } from "./storage-contract.ts";
import { lessonToRow, rowToLesson, SupabaseLessonStorage, type LessonRow } from "./storage-supabase.ts";

const lesson: Lesson = {
  editId: "A".repeat(32),
  slug: "abcde12345",
  status: "published",
  materials: sampleMaterials,
  transcript: "[00:01] Ментор: Привет.",
  recordingUrl: null,
  language: "kk",
  mock: true,
  startedAt: "2026-11-09T10:00:00.000Z",
  createdAt: "2026-11-09T10:05:00.000Z",
  generatedAt: "2026-11-09T10:05:00.000Z",
  updatedAt: "2026-11-09T10:10:00.000Z",
  publishedAt: "2026-11-09T10:14:00.000Z",
  firstPublishedAt: "2026-11-09T10:14:00.000Z",
  prepDurationMs: 840000,
  activePrepMs: 600000,
};

describe("строки таблицы lessons", () => {
  it("lessonToRow → rowToLesson без потерь", () => {
    assert.deepEqual(rowToLesson(lessonToRow(lesson)), lesson);
  });

  it("понимает формат дат Postgres и bigint строкой", () => {
    const row: LessonRow = {
      ...lessonToRow(lesson),
      created_at: "2026-11-09T10:05:00+00:00",
      published_at: "2026-11-09T15:14:00.000+05:00",
      prep_duration_ms: "840000",
      active_prep_ms: "600000",
    };
    const parsed = rowToLesson(row);
    assert.equal(parsed?.createdAt, "2026-11-09T10:05:00.000Z");
    assert.equal(parsed?.publishedAt, "2026-11-09T10:14:00.000Z");
    assert.equal(parsed?.prepDurationMs, 840000);
    assert.equal(parsed?.activePrepMs, 600000);
  });

  it("повреждённая строка → null, а не исключение", () => {
    assert.equal(rowToLesson({ ...lessonToRow(lesson), status: "archived" }), null);
    assert.equal(rowToLesson({ ...lessonToRow(lesson), materials: { title: "" } }), null);
  });

  it("имена колонок совпадают с миграцией", async () => {
    const { readFile } = await import("node:fs/promises");
    const { readdirSync } = await import("node:fs");
    const dir = new URL("../supabase/migrations/", import.meta.url);
    const sql = (await Promise.all(readdirSync(dir).map((f) => readFile(new URL(f, dir), "utf8")))).join("\n");
    for (const column of Object.keys(lessonToRow(lesson))) {
      assert.match(sql, new RegExp(`\\n\\s+${column}\\s`), `нет колонки ${column} в миграции`);
    }
  });
});

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (url && key) {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = new SupabaseLessonStorage(db);
  runStorageContract("Supabase (интеграция)", () => storage);
} else {
  describe("LessonStorage: Supabase (интеграция)", () => {
    it.skip("нужны SUPABASE_TEST_URL и SUPABASE_TEST_SERVICE_ROLE_KEY", () => {});
  });
}
