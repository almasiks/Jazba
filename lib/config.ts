/**
 * Настройки из переменных окружения — чистые функции (без чтения process.env внутри),
 * чтобы их можно было проверить тестами.
 */

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {}

export type StorageKind = "local" | "supabase";

/**
 * STORAGE=local|supabase. Если не задано — supabase при наличии SUPABASE_URL, иначе local.
 * На Vercel файловая система только для чтения, поэтому local там запрещён.
 */
export function resolveStorageKind(env: Env): StorageKind {
  const raw = env.STORAGE?.trim().toLowerCase();
  let kind: StorageKind;
  if (!raw) kind = env.SUPABASE_URL ? "supabase" : "local";
  else if (raw === "local" || raw === "supabase") kind = raw;
  else throw new ConfigError(`Неизвестное значение STORAGE="${env.STORAGE}". Используйте local или supabase.`);

  if (kind === "local" && env.VERCEL) {
    throw new ConfigError(
      "На Vercel нельзя хранить занятия в файлах. Задайте STORAGE=supabase, SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return kind;
}

export function resolveSupabaseConfig(env: Env): { url: string; serviceRoleKey: string } {
  if (env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    // NEXT_PUBLIC_* попадает в браузер — секретный ключ так называть нельзя
    throw new ConfigError(
      "Секретный ключ задан как NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY — так он попадёт в браузер. Переименуйте в SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new ConfigError("Для STORAGE=supabase нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, serviceRoleKey };
}

export type AuthConfig =
  | { mode: "password"; password: string; secret: string }
  | { mode: "open" } // для локальной разработки без пароля
  | { mode: "misconfigured" }; // продакшен без пароля — ментору никуда нельзя

/**
 * MENTOR_PASSWORD включает вход по паролю. Без него:
 *  - при разработке (NODE_ENV !== production) страницы ментора открыты;
 *  - в продакшене — закрыты совсем, пока пароль не задан.
 * SESSION_SECRET (необязательно) — отдельный ключ подписи cookie;
 * по умолчанию подпись выводится из пароля, и смена пароля разлогинивает всех.
 */
export function resolveAuthConfig(env: Env): AuthConfig {
  const password = env.MENTOR_PASSWORD;
  if (password) return { mode: "password", password, secret: env.SESSION_SECRET || `jazba:${password}` };
  return env.NODE_ENV === "production" ? { mode: "misconfigured" } : { mode: "open" };
}

// ---------- ИИ-провайдер ----------

export type AiProvider = "openai" | "gemini" | "openrouter";
export type AiConfig = { provider: AiProvider; apiKey: string | null; model: string };

const AI_PROVIDERS: readonly AiProvider[] = ["openai", "gemini", "openrouter"];

export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  openai: "gpt-5-mini",
  gemini: "gemini-3.8-flash",
  openrouter: "openai/gpt-5-mini",
};

/** Ключи OpenRouter начинаются с sk-or- и больше нигде не работают. */
const isOpenRouterKey = (key: string | undefined) => key?.startsWith("sk-or-") ?? false;

/** В OpenRouter модель пишется с владельцем: gemini-3.8-flash → google/gemini-3.8-flash. */
function openRouterModel(model: string): string {
  if (model.includes("/")) return model;
  if (model.startsWith("gemini")) return `google/${model}`;
  if (/^(gpt|o\d)/.test(model)) return `openai/${model}`;
  return model;
}

/** Убирает пробелы и случайные кавычки вокруг значения: ' "abc" ' → abc. */
function cleanValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  return trimmed || undefined;
}

/**
 * Какой ИИ использовать.
 *  - AI_PROVIDER=openai|gemini|openrouter (если не задан — по тому, какой ключ есть);
 *  - ключ: AI_API_KEY или ключ конкретного провайдера (OPENAI_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY);
 *  - модель: AI_MODEL, OPENAI_MODEL / GEMINI_MODEL / OPENROUTER_MODEL или модель по умолчанию.
 * Ключ вида sk-or-… всегда означает OpenRouter, даже если AI_PROVIDER указан другой.
 * Ключа нет → apiKey = null (тогда включается демо-режим).
 */
export function resolveAiConfig(env: Env): AiConfig {
  const raw = cleanValue(env.AI_PROVIDER)?.toLowerCase();
  const sharedKey = cleanValue(env.AI_API_KEY);
  let provider: AiProvider;
  if (isOpenRouterKey(sharedKey)) provider = "openrouter";
  else if (!raw) {
    if (cleanValue(env.OPENROUTER_API_KEY) && !cleanValue(env.OPENAI_API_KEY)) provider = "openrouter";
    else if (cleanValue(env.GEMINI_API_KEY) && !cleanValue(env.OPENAI_API_KEY)) provider = "gemini";
    else provider = "openai";
  } else if ((AI_PROVIDERS as readonly string[]).includes(raw)) provider = raw as AiProvider;
  else {
    throw new ConfigError(`Неизвестный AI_PROVIDER="${env.AI_PROVIDER}". Используйте openai, gemini или openrouter.`);
  }

  const ownKey = { openai: env.OPENAI_API_KEY, gemini: env.GEMINI_API_KEY, openrouter: env.OPENROUTER_API_KEY }[provider];
  const ownModel = { openai: env.OPENAI_MODEL, gemini: env.GEMINI_MODEL, openrouter: env.OPENROUTER_MODEL }[provider];
  const model = cleanValue(env.AI_MODEL) ?? cleanValue(ownModel) ?? DEFAULT_AI_MODELS[provider];
  return {
    provider,
    apiKey: sharedKey ?? cleanValue(ownKey) ?? null,
    model: provider === "openrouter" ? openRouterModel(model) : model,
  };
}

export type RateLimits = { perHour: number; perMinute: number };

/** Лимиты генерации (вызовов OpenAI): общий в час и на один IP в минуту. */
export function resolveRateLimits(env: Env): RateLimits {
  const num = (value: string | undefined, fallback: number) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  return {
    perHour: num(env.GENERATION_LIMIT_PER_HOUR, 30),
    perMinute: num(env.GENERATION_LIMIT_PER_MINUTE, 3),
  };
}
