import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, safeNextPath, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth";
import { resolveAuthConfig } from "@/lib/config";
import { clientIp, getRateLimiter } from "@/lib/server/guard";

const LOGIN_ATTEMPTS = 10; // попыток входа с одного IP
const LOGIN_WINDOW_SECONDS = 15 * 60;

/** Вход ментора: обычная HTML-форма (работает и без JavaScript). */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const password = String(form?.get("password") ?? "");
  const next = safeNextPath(String(form?.get("next") ?? ""));
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const back = (error: string) =>
    redirectTo(`/login?error=${error}&next=${encodeURIComponent(next)}`);

  const auth = resolveAuthConfig(process.env);
  if (auth.mode === "open") return redirectTo(next);
  if (auth.mode === "misconfigured") return back("config");

  // Защита от перебора пароля
  if (!(await getRateLimiter().consume(`login:${clientIp(request)}`, LOGIN_ATTEMPTS, LOGIN_WINDOW_SECONDS))) {
    return back("rate");
  }
  if (!(await checkPassword(password, auth.password))) return back("password");

  const response = redirectTo(next);
  response.cookies.set(SESSION_COOKIE, await createSessionToken(auth.secret), {
    httpOnly: true, // недоступна из JavaScript страницы
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return response;
}
