import { fail, readJson } from "@/lib/api-errors";
import { deleteLessonApi } from "@/lib/lesson-api";
import { saveLessonContent } from "@/lib/lessons";
import { requireMentorApi } from "@/lib/server/guard";
import { formatIssues, SaveLessonRequestSchema } from "@/lib/schema";
import { getStorage } from "@/lib/server/storage";
import { SupabaseStorageError } from "@/lib/storage-supabase";

/** Автосохранение из редактора: материалы и ссылка на запись. Доступ — только по editId. */
export async function PUT(request: Request, ctx: RouteContext<"/api/lessons/[editId]">) {
  const denied = await requireMentorApi(request);
  if (denied) return denied;
  const { editId } = await ctx.params;
  const parsed = SaveLessonRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return fail("Есть ошибки в материалах — исправьте их, и мы сохраним.", 400, formatIssues(parsed.error));
  }

  const lesson = await saveLessonContent(getStorage(), editId, parsed.data);
  if (!lesson) return fail("Занятие не найдено.", 404);
  return Response.json({ ok: true, updatedAt: lesson.updatedAt });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/lessons/[editId]">) {
  const { editId } = await ctx.params;
  try {
    return await deleteLessonApi(request, editId, { storage: getStorage(), env: process.env });
  } catch (error) {
    if (error instanceof SupabaseStorageError) return fail(error.message, 503);
    throw error;
  }
}
