/**
 * Ограничение частоты запросов (скользящее окно).
 * Реализации: в памяти (разработка) и в Supabase (общая для всех экземпляров на Vercel).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseStorageError } from "./storage-supabase.ts";

export const RATE_LIMIT_DB_ERROR =
  "Не удалось проверить лимит генераций: ошибка базы данных. Проверьте, что применены миграции Supabase и верны SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY";

export interface RateLimiter {
  /** true — запрос разрешён и учтён; false — лимит исчерпан. Не удалось проверить — исключение. */
  consume(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly events = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = this.now();
    const recent = (this.events.get(key) ?? []).filter((t) => t > now - windowSeconds * 1000);
    if (recent.length >= limit) {
      this.events.set(key, recent);
      return false;
    }
    recent.push(now);
    this.events.set(key, recent);
    return true;
  }
}

export class SupabaseRateLimiter implements RateLimiter {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const { data, error } = await this.db.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      // Лучше отказать, чем молча тратить баланс OpenAI без лимита, — но назвать настоящую причину
      console.error("[rate-limit] Supabase:", error.message);
      throw new SupabaseStorageError(RATE_LIMIT_DB_ERROR);
    }
    return data === true;
  }
}

export type RateLimitResult = { ok: true } | { ok: false; message: string };

/**
 * Лимиты на генерацию (каждый вызов OpenAI):
 *  - общий в час — защищает баланс, даже если пароль утёк;
 *  - на IP в минуту — от случайных многократных нажатий и скриптов.
 */
export async function checkGenerationLimit(
  limiter: RateLimiter,
  ip: string,
  limits: { perHour: number; perMinute: number },
): Promise<RateLimitResult> {
  if (!(await limiter.consume(`generate:ip:${ip}`, limits.perMinute, 60))) {
    return { ok: false, message: "Слишком много запросов на генерацию. Подождите минуту и попробуйте снова." };
  }
  if (!(await limiter.consume("generate:global", limits.perHour, 3600))) {
    return {
      ok: false,
      message: `Достигнут лимит генераций (${limits.perHour} в час) — это защита баланса OpenAI. Попробуйте позже.`,
    };
  }
  return { ok: true };
}
