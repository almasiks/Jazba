import { fail, generationErrorResponse, readJson } from "@/lib/api-errors";
import { generateBlock } from "@/lib/generation";
import { isMockMode } from "@/lib/mock";
import { checkGenerationLimit } from "@/lib/rate-limit";
import { clientIp, getRateLimiter, getRateLimits, requireMentorApi } from "@/lib/server/guard";
import { RegenerateRequestSchema } from "@/lib/schema";
import { getStorage } from "@/lib/server/storage";

export const maxDuration = 300;

/**
 * Перегенерирует один блок по сохранённому транскрипту.
 * Ничего не сохраняет: новый блок возвращается в редактор, и ментор
 * видит его сразу; сохранит автосохранение вместе с остальными правками.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[editId]/regenerate">) {
  const denied = await requireMentorApi(request);
  if (denied) return denied;
  const { editId } = await ctx.params;
  const parsed = RegenerateRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Неизвестный блок материалов.", 400);

  const lesson = await getStorage().get(editId);
  if (!lesson) return fail("Занятие не найдено.", 404);

  try {
    if (!isMockMode()) {
      const limit = await checkGenerationLimit(getRateLimiter(), clientIp(request), getRateLimits());
      if (!limit.ok) return fail(limit.message, 429);
    }
    const value = await generateBlock(parsed.data.block, lesson.transcript, lesson.language);
    return Response.json({ ok: true, block: parsed.data.block, value });
  } catch (error) {
    return generationErrorResponse(error);
  }
}
