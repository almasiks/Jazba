/**
 * Правила доступа для proxy.ts — чистая функция, проверяется тестами.
 *
 *  - /s/<slug> — страница студента, открыта всем (только формат slug);
 *  - /login, /api/login, /api/logout — открыты;
 *  - страницы ментора (/, /lessons, /lessons/<editId>) и его API — только после входа;
 *  - /lessons/<id> принимает только формат editId, /s/<id> — только формат slug.
 */
import type { AuthConfig } from "./config.ts";
import { isEditId, isSlug } from "./ids.ts";

export type AccessDecision =
  | { action: "allow" }
  | { action: "not-found" }
  | { action: "login"; next: string } // страница → редирект на /login
  | { action: "unauthorized" } // API → 401
  | { action: "misconfigured" }; // продакшен без MENTOR_PASSWORD → 503 для API

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);
const MENTOR_API_PREFIXES = ["/api/generate", "/api/lessons", "/api/sample"];

function isMentorPage(pathname: string): boolean {
  return pathname === "/" || pathname === "/lessons" || pathname.startsWith("/lessons/");
}

export function decideAccess(
  pathname: string,
  auth: AuthConfig["mode"],
  hasSession: boolean,
): AccessDecision {
  // Студенты
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    const [, , slug = "", ...rest] = pathname.split("/");
    return isSlug(slug) && rest.length === 0 ? { action: "allow" } : { action: "not-found" };
  }
  if (PUBLIC_PATHS.has(pathname)) return { action: "allow" };

  const mentorApi = MENTOR_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const mentorPage = isMentorPage(pathname);
  if (!mentorApi && !mentorPage) return { action: "allow" }; // статика, 404 и т.п.

  const authorized = auth === "open" || (auth === "password" && hasSession);
  if (!authorized) {
    if (mentorApi) return auth === "misconfigured" ? { action: "misconfigured" } : { action: "unauthorized" };
    return { action: "login", next: pathname };
  }

  // Редактор — только по editId (slug сюда не подходит)
  if (pathname.startsWith("/lessons/")) {
    const [, , id = "", ...rest] = pathname.split("/");
    if (!isEditId(id) || rest.length > 0) return { action: "not-found" };
  }
  return { action: "allow" };
}
