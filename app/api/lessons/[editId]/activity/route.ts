import { z } from "zod";
import { fail, readJson } from "@/lib/api-errors";
import { addActiveTime } from "@/lib/lessons";
import { requireMentorApi } from "@/lib/server/guard";
import { getStorage } from "@/lib/server/storage";

const BodySchema = z.object({ ms: z.number() });

/** Редактор присылает накопленное активное время ментора (см. lib/active-time.ts). */
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[editId]/activity">) {
  const denied = await requireMentorApi(request);
  if (denied) return denied;
  const { editId } = await ctx.params;
  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Некорректный запрос.", 400);

  const lesson = await addActiveTime(getStorage(), editId, parsed.data.ms);
  if (!lesson) return fail("Занятие не найдено.", 404);
  return Response.json({ ok: true, activePrepMs: lesson.activePrepMs });
}
