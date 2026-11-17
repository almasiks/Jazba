/**
 * Логика API, не зависящая от Next.js: проверка входа ментора и удаление занятий.
 * Route handlers только передают сюда запрос, хранилище и process.env — так всё проверяется тестами.
 */
import { z } from "zod";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "./auth.ts";
import { resolveAuthConfig } from "./config.ts";
import type { LessonStorage } from "./storage.ts";

type Env = Record<string, string | undefined>;

export type ApiDeps = { storage: LessonStorage; env: Env };

/** Сколько занятий можно удалить одним запросом. */
export const MAX_BULK_DELETE = 200;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function failure(error: string, status: number) {
  return json({ ok: false, error }, status);
}

/** Есть ли у запроса действующая сессия ментора (или вход не нужен — локальная разработка). */
export async function isMentorRequest(request: Request, env: Env): Promise<boolean> {
  const auth = resolveAuthConfig(env);
  if (auth.mode === "open") return true;
  if (auth.mode === "misconfigured") return false;
  return verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE), auth.secret);
}

/** null — доступ есть, иначе готовый ответ 401. */
export async function requireMentor(request: Request, env: Env): Promise<Response | null> {
  if (await isMentorRequest(request, env)) return null;
  return failure("Нужно войти как ментор.", 401);
}

/** DELETE /api/lessons/<editId> */
export async function deleteLessonApi(request: Request, editId: string, deps: ApiDeps): Promise<Response> {
  const denied = await requireMentor(request, deps.env);
  if (denied) return denied;
  if (!(await deps.storage.delete(editId))) return failure("Занятие не найдено.", 404);
  return json({ ok: true, deleted: [editId] });
}

const BulkDeleteSchema = z.object({
  editIds: z.array(z.string()).min(1).max(MAX_BULK_DELETE),
});

/** DELETE /api/lessons с телом { editIds: [...] } — массовое удаление. */
export async function deleteLessonsApi(request: Request, deps: ApiDeps): Promise<Response> {
  const denied = await requireMentor(request, deps.env);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = BulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return failure(`Передайте от 1 до ${MAX_BULK_DELETE} занятий для удаления.`, 400);
  }

  const deleted = await deps.storage.deleteMany(parsed.data.editIds);
  return json({ ok: true, deleted });
}
