/**
 * Генерация материалов: все блоки сразу или один блок.
 * В демо-режиме (см. lib/mock.ts) ИИ не вызывается.
 */
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { isMockMode, loadMockMaterials } from "./mock.ts";
import { getAiClient } from "./openai.ts";
import { buildBlockSystemPrompt, buildMaterialsSystemPrompt, buildMaterialsUserPrompt } from "./prompts.ts";
import {
  BlockResponseSchemas,
  MaterialsResponseSchema,
  normalizeBlock,
  normalizeMaterials,
  type BlockKey,
  type Language,
  type Materials,
} from "./schema.ts";
import { extractTimecodes } from "./timecode.ts";

export class EmptyModelResponseError extends Error {}

const MOCK_DELAY_MS = 1200; // чтобы в демо был виден индикатор загрузки
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Запрос со структурированным ответом по zod-схеме.
 * OpenAI — Responses API; Gemini и OpenRouter — OpenAI-совместимый Chat Completions.
 */
async function requestStructured<T extends z.ZodType>(
  schema: T,
  name: string,
  instructions: string,
  input: string,
): Promise<z.infer<T>> {
  const { client, config } = getAiClient();

  if (config.provider !== "openai") {
    const completion = await client.chat.completions.parse({
      model: config.model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
      response_format: zodResponseFormat(schema, name),
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) throw new EmptyModelResponseError();
    return parsed as z.infer<T>;
  }

  const response = await client.responses.parse({
    model: config.model,
    instructions,
    input,
    text: { format: zodTextFormat(schema, name) },
  });
  if (!response.output_parsed) throw new EmptyModelResponseError();
  return response.output_parsed as z.infer<T>;
}

export async function generateMaterials(
  transcript: string,
  language: Language,
): Promise<{ materials: Materials; mock: boolean }> {
  if (isMockMode()) {
    await delay(MOCK_DELAY_MS);
    return { materials: await loadMockMaterials(), mock: true };
  }

  // Таймкоды, которые реально есть в транскрипте — по ним проверяем ответ модели
  const marks = extractTimecodes(transcript);
  const parsed = await requestStructured(
    MaterialsResponseSchema,
    "materials",
    buildMaterialsSystemPrompt(language, marks.length > 0),
    buildMaterialsUserPrompt(transcript),
  );
  return { materials: normalizeMaterials(parsed, marks), mock: false };
}

/** Заново генерирует только один блок по сохранённому транскрипту. */
export async function generateBlock<K extends BlockKey>(
  block: K,
  transcript: string,
  language: Language,
): Promise<Materials[K]> {
  if (isMockMode()) {
    await delay(MOCK_DELAY_MS);
    return (await loadMockMaterials())[block];
  }

  const marks = extractTimecodes(transcript);
  const parsed = (await requestStructured(
    BlockResponseSchemas[block],
    block,
    buildBlockSystemPrompt(block, language, marks.length > 0),
    buildMaterialsUserPrompt(transcript),
  )) as Record<K, never>;
  return normalizeBlock(block, parsed[block], marks);
}
