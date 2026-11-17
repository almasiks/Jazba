import { sanitizeActiveMs } from "@/lib/active-time";
import { fail, generationErrorResponse, readJson } from "@/lib/api-errors";
import { generateMaterials } from "@/lib/generation";
import { isMockMode } from "@/lib/mock";
import { checkGenerationLimit } from "@/lib/rate-limit";
import { clientIp, getRateLimiter, getRateLimits, requireMentorApi } from "@/lib/server/guard";
import {
  GenerateRequestSchema,
  TRANSCRIPT_MAX_LENGTH,
  TRANSCRIPT_MIN_LENGTH,
  type GenerateResponse,
} from "@/lib/schema";
import { getStorage } from "@/lib/server/storage";

// Генерация длинного транскрипта может занимать пару минут.
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Генерирует материалы и сохраняет занятие как черновик. Возвращает editId для редактора. */
export async function POST(request: Request) {
  const denied = await requireMentorApi(request);
  if (denied) return denied;

  // 1. Проверяем ввод
  const parsed = GenerateRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return fail(
      parsed.error.issues.find((i) => i.path[0] === "recordingUrl")?.message ??
        "Некорректный запрос: нужен транскрипт и язык (ru или kk).",
      400,
    );
  }

  const transcript = parsed.data.transcript.trim();
  const { language, recordingUrl } = parsed.data;

  if (!transcript) return fail("Вставьте транскрипт занятия.", 400);
  if (transcript.length < TRANSCRIPT_MIN_LENGTH) {
    return fail(
      `Транскрипт слишком короткий — нужно хотя бы ${TRANSCRIPT_MIN_LENGTH} символов, чтобы было из чего делать материалы.`,
      400,
    );
  }
  if (transcript.length > TRANSCRIPT_MAX_LENGTH) {
    return fail(
      `Транскрипт слишком длинный: ${transcript.length.toLocaleString("ru-RU")} символов при максимуме ${TRANSCRIPT_MAX_LENGTH.toLocaleString("ru-RU")}. Сократите текст или разделите занятие на части.`,
      413,
    );
  }

  // Начало подготовки (для метрики) — из браузера; защищаемся от странных значений
  const now = Date.now();
  const startedAt =
    parsed.data.startedAt && parsed.data.startedAt <= now && now - parsed.data.startedAt < DAY_MS
      ? new Date(parsed.data.startedAt)
      : new Date(now);
  // Активное время не может быть больше, чем прошло с начала подготовки
  const activePrepMs = sanitizeActiveMs(parsed.data.activeMs, now - startedAt.getTime());

  // 2. Генерируем (или берём демо) и сохраняем черновик
  try {
    // Лимит частоты — только для настоящих вызовов OpenAI (демо ничего не тратит)
    if (!isMockMode()) {
      const limit = await checkGenerationLimit(getRateLimiter(), clientIp(request), getRateLimits());
      if (!limit.ok) return fail(limit.message, 429);
    }

    const { materials, mock } = await generateMaterials(transcript, language);
    const lesson = await getStorage().create({
      materials,
      transcript,
      recordingUrl,
      language,
      mock,
      startedAt,
      activePrepMs,
    });
    return Response.json({ ok: true, editId: lesson.editId, mock } satisfies GenerateResponse);
  } catch (error) {
    return generationErrorResponse(error);
  }
}
