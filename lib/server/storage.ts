import "server-only";

import path from "node:path";
import { resolveStorageKind } from "../config.ts";
import { JsonFileLessonStorage, type LessonStorage } from "../storage.ts";
import { SupabaseLessonStorage } from "../storage-supabase.ts";
import { getSupabaseAdmin } from "./supabase.ts";

let storage: LessonStorage | null = null;

/**
 * Хранилище приложения: STORAGE=local (JSON в data/lessons/, для разработки)
 * или STORAGE=supabase (для деплоя). Остальной код знает только интерфейс LessonStorage.
 */
export function getStorage(): LessonStorage {
  if (!storage) {
    storage =
      resolveStorageKind(process.env) === "supabase"
        ? new SupabaseLessonStorage(getSupabaseAdmin())
        : new JsonFileLessonStorage(process.env.LESSONS_DIR || path.join(process.cwd(), "data", "lessons"));
  }
  return storage;
}
