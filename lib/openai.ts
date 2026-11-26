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

/**
 * Сколько ждём модель. Должно быть меньше maxDuration роутов (300 с — потолок Vercel Hobby),
 * чтобы пользователь увидел понятную ошибку, а не 504.
 */
export const AI_TIMEOUT_MS = 240_000;

export class AiTimeoutError extends Error {}

/**
 * Общий срок на запрос вместе с повторами: timeout клиента действует на каждую попытку
 * отдельно, и с повтором ожидание могло бы стать вдвое дольше.
 */
export async function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, ms = AI_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AiTimeoutError(`Модель не ответила за ${ms / 1000} с`));
      controller.abort();
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Пишет в лог каждую попытку обращения к ИИ (и повторы тоже): статус и время. Без ключей и текста. */
function loggingFetch(label: string): typeof fetch {
  return async (input, init) => {
    const started = Date.now();
    const seconds = () => ((Date.now() - started) / 1000).toFixed(1);
    try {
      const response = await fetch(input, init);
      console.log(`[ai] ${label}: HTTP ${response.status} за ${seconds()} с`);
      return response;
    } catch (error) {
      console.error(`[ai] ${label}: ${error instanceof Error ? error.name : "ошибка"} через ${seconds()} с`);
      throw error;
    }
  };
}

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
  const cacheKey = `${config.provider}:${config.model}:${config.apiKey}`;
  if (cached?.key !== cacheKey) {
    cached = {
      key: cacheKey,
      client: new OpenAI({
        apiKey: config.apiKey,
        timeout: AI_TIMEOUT_MS,
        maxRetries: 1,
        fetch: loggingFetch(`${config.provider} ${config.model}`),
        ...(BASE_URLS[config.provider] ? { baseURL: BASE_URLS[config.provider] } : {}),
        // OpenRouter просит название приложения (необязательно, для их статистики)
        ...(config.provider === "openrouter" ? { defaultHeaders: { "X-Title": "Jazba" } } : {}),
      }),
    };
  }
  return { client: cached.client, config };
}
