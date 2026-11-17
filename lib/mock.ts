/**
 * Демо-режим без ИИ: вместо запроса к OpenAI отдаём готовые материалы
 * из samples/mock-materials.json (таймкоды — по samples/js-arrays-lesson.vtt).
 *
 * Включается, если MOCK_GENERATION=true или не задан ключ ИИ (AI_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY).
 * Только для сервера (читает файлы и переменные окружения).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ConfigError, resolveAiConfig } from "./config.ts";
import { MaterialsResponseSchema, normalizeMaterials, type Materials } from "./schema.ts";
import { extractTimecodes } from "./timecode.ts";

export const MOCK_MATERIALS_PATH = path.join(process.cwd(), "samples", "mock-materials.json");

export function isMockMode(env: Record<string, string | undefined> = process.env): boolean {
  if (env.MOCK_GENERATION?.trim().toLowerCase() === "true") return true;
  try {
    return !resolveAiConfig(env).apiKey;
  } catch (error) {
    // Ошибка в настройках (например, неизвестный AI_PROVIDER) — не прячем её за демо: покажется при генерации
    if (error instanceof ConfigError) return false;
    throw error;
  }
}

/** Читает и проверяет мок-материалы; при ошибке в файле бросает исключение. */
export async function loadMockMaterials(): Promise<Materials> {
  const raw = MaterialsResponseSchema.parse(JSON.parse(await readFile(MOCK_MATERIALS_PATH, "utf8")));
  // Таймкоды мока уже соответствуют примеру — сверяем их сами с собой, чтобы получить тип Materials
  const own = [...raw.summary, ...raw.quiz, ...raw.faq]
    .map((item) => (item.timestamp ? `[${item.timestamp}]` : ""))
    .join(" ");
  return normalizeMaterials(raw, extractTimecodes(own));
}
