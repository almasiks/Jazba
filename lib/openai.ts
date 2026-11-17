import OpenAI from "openai";
import { ConfigError, resolveAiConfig, type AiConfig } from "./config.ts";

export { ConfigError };

/**
 * Клиент ИИ. Работаем через SDK OpenAI: у Gemini есть OpenAI-совместимый API,
 * поэтому достаточно поменять адрес. Ключ и модель — только из переменных окружения.
 */

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const BASE_URLS: Partial<Record<AiConfig["provider"], string>> = {
  gemini: GEMINI_BASE_URL,
  openrouter: OPENROUTER_BASE_URL,
};

export const PROVIDER_NAMES = { openai: "OpenAI", gemini: "Gemini", openrouter: "OpenRouter" } as const;

let cached: { key: string; client: OpenAI } | null = null;

export function getAiConfig(): AiConfig {
  return resolveAiConfig(process.env);
}

export function getAiClient(): { client: OpenAI; config: AiConfig } {
  const config = getAiConfig();
  if (!config.apiKey) {
    throw new ConfigError(
      "Не задан ключ ИИ. Добавьте AI_API_KEY (или OPENAI_API_KEY) в .env.local (или в Environment Variables на Vercel) и перезапустите сервер.",
    );
  }
  const bad = config.apiKey.search(/[^\x21-\x7e]/);
  if (bad !== -1) {
    // Иначе fetch падает с непонятным "Cannot convert argument to a ByteString".
    // Показываем только лишний символ и его место — сам ключ не выводим.
    const char = config.apiKey[bad];
    const shown = /\s/.test(char) ? "пробел" : `«${char}»`;
    throw new ConfigError(
      `В AI_API_KEY лишний символ: ${shown} на ${bad + 1}-й позиции (всего символов: ${config.apiKey.length}). ` +
        "Оставьте в строке только сам ключ (латиница и цифры), комментарии — на отдельной строке с #, и сохраните .env.local.",
    );
  }
  const cacheKey = `${config.provider}:${config.apiKey}`;
  if (cached?.key !== cacheKey) {
    cached = {
      key: cacheKey,
      client: new OpenAI({
        apiKey: config.apiKey,
        ...(BASE_URLS[config.provider] ? { baseURL: BASE_URLS[config.provider] } : {}),
        // OpenRouter просит название приложения (необязательно, для их статистики)
        ...(config.provider === "openrouter" ? { defaultHeaders: { "X-Title": "Jazba" } } : {}),
      }),
    };
  }
  return { client: cached.client, config };
}
