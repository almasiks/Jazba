/**
 * Ответы API с ошибками — понятные сообщения на русском.
 */
import OpenAI from "openai";
import { ContentFilterFinishReasonError, LengthFinishReasonError } from "openai/error";
import { EmptyModelResponseError } from "./generation.ts";
import { resolveAiConfig, type AiConfig } from "./config.ts";
import { AiTimeoutError, ConfigError, PROVIDER_NAMES } from "./openai.ts";
import { SupabaseStorageError } from "./storage-supabase.ts";
import type { ApiError } from "./schema.ts";

export function fail(error: string, status: number, issues?: string[]) {
  return Response.json({ ok: false, error, ...(issues ? { issues } : {}) } satisfies ApiError, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Текущий провайдер для сообщений; если настройки сломаны — OpenAI по умолчанию. */
function currentAi(): AiConfig {
  try {
    return resolveAiConfig(process.env);
  } catch {
    return { provider: "openai", apiKey: null, model: "" };
  }
}

/** Gemini на неверный ключ отвечает 400 с текстом про API key, а не 401. */
function isInvalidKey(error: InstanceType<typeof OpenAI.APIError>): boolean {
  return error.status === 400 && /(api|auth)[ _-]?key/i.test(error.message);
}

/** Ошибка генерации (ИИ, конфигурация, мок) → ответ API. */
export function generationErrorResponse(error: unknown) {
  const ai = currentAi();
  const name = PROVIDER_NAMES[ai.provider];
  if (error instanceof ConfigError) return fail(error.message, 500);
  if (error instanceof SupabaseStorageError) return fail(error.message, 503);
  if (error instanceof EmptyModelResponseError) {
    return fail("Модель не вернула материалы. Попробуйте ещё раз.", 502);
  }
  if (error instanceof OpenAI.AuthenticationError || (error instanceof OpenAI.APIError && isInvalidKey(error))) {
    console.error(`[generate] ${name} отклонил ключ:`, error.status, error.message);
    return fail(`Ключ ${name} недействителен. Проверьте AI_API_KEY (в .env.local или в настройках Vercel).`, 500);
  }
  if (error instanceof OpenAI.RateLimitError) {
    return fail(
      `Превышен лимит запросов к ${name} или закончилась квота. Подождите минуту и попробуйте снова.`,
      429,
    );
  }
  if (error instanceof OpenAI.APIError && error.status === 402) {
    return fail(`На счёте ${name} не хватает средств для этой модели. Пополните баланс или выберите другую модель (AI_MODEL).`, 402);
  }
  if (error instanceof OpenAI.NotFoundError) {
    console.error(`[generate] ${name} 404:`, error.message);
    return fail(`Модель "${ai.model}" не найдена в ${name} или недоступна для этого ключа. Проверьте AI_MODEL.`, 500);
  }
  // APIConnectionTimeoutError — частный случай APIConnectionError, поэтому проверяется раньше
  if (error instanceof AiTimeoutError || error instanceof OpenAI.APIConnectionTimeoutError) {
    console.error(`[generate] ${name}: таймаут`);
    return fail("Модель отвечает слишком долго, попробуйте ещё раз.", 503);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return fail(`Не удалось связаться с ${name}. Проверьте интернет-соединение.`, 502);
  }
  if (error instanceof LengthFinishReasonError) {
    return fail("Ответ модели оборвался из-за ограничения длины. Попробуйте сократить транскрипт.", 502);
  }
  if (error instanceof ContentFilterFinishReasonError) {
    return fail("Модель отказалась обрабатывать этот текст.", 422);
  }
  if (error instanceof OpenAI.APIError) {
    console.error(`[generate] ${name} API error:`, error.status, error.message);
    return fail(`Ошибка ${name} (${error.status ?? "нет кода"}). Попробуйте ещё раз позже.`, 502);
  }
  console.error("[generate] Unexpected error:", error);
  return fail("Что-то пошло не так при генерации. Попробуйте ещё раз.", 500);
}
