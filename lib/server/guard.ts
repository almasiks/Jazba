import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "../auth.ts";
import { resolveAuthConfig, resolveRateLimits, resolveStorageKind } from "../config.ts";
import { requireMentor } from "../lesson-api.ts";
import { MemoryRateLimiter, SupabaseRateLimiter, type RateLimiter } from "../rate-limit.ts";
import { getSupabaseAdmin } from "./supabase.ts";

/**
 * Серверные проверки доступа ментора. proxy.ts отсекает неавторизованных заранее,
 * а эти функции — вторая линия защиты прямо в API и страницах.
 */

async function hasMentorSession(token: string | undefined): Promise<boolean> {
  const auth = resolveAuthConfig(process.env);
  if (auth.mode === "open") return true;
  if (auth.mode === "misconfigured") return false;
  return verifySessionToken(token, auth.secret);
}

/** Для route handlers: null — доступ есть, иначе готовый ответ 401. */
export async function requireMentorApi(request: Request): Promise<Response | null> {
  return requireMentor(request, process.env);
}

/** Для серверных компонентов страниц ментора. */
export async function isMentor(): Promise<boolean> {
  await connection(); // проверка зависит от времени (срок сессии) — только во время запроса, не при пререндере
  return hasMentorSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** IP клиента (на Vercel — первый адрес из x-forwarded-for). */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

let limiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  limiter ??=
    resolveStorageKind(process.env) === "supabase"
      ? new SupabaseRateLimiter(getSupabaseAdmin())
      : new MemoryRateLimiter();
  return limiter;
}

export function getRateLimits() {
  return resolveRateLimits(process.env);
}
