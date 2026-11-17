import { z } from "zod";
import { fail, readJson } from "@/lib/api-errors";
import { publishLesson, unpublishLesson } from "@/lib/lessons";
import { requireMentorApi } from "@/lib/server/guard";
import { getStorage } from "@/lib/server/storage";

const BodySchema = z.object({ published: z.boolean(), activeMs: z.number().optional() });

/** Опубликовать / снять с публикации. */
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[editId]/publish">) {
  const denied = await requireMentorApi(request);
  if (denied) return denied;
  const { editId } = await ctx.params;
  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Некорректный запрос.", 400);

  const storage = getStorage();
  const lesson = parsed.data.published
    ? await publishLesson(storage, editId, new Date(), parsed.data.activeMs ?? 0)
    : await unpublishLesson(storage, editId);
  if (!lesson) return fail("Занятие не найдено.", 404);

  return Response.json({
    ok: true,
    status: lesson.status,
    publishedAt: lesson.publishedAt,
    prepDurationMs: lesson.prepDurationMs,
    activePrepMs: lesson.activePrepMs,
    firstPublishedAt: lesson.firstPublishedAt,
  });
}
