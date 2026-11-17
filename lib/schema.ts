import { z } from "zod";
import { parseTimecode, snapTimecode, type TimecodeMark } from "./timecode.ts";

/* =====================================================================
 * 1. Схема ответа модели (Structured Outputs, strict).
 *
 * В strict-режиме все поля обязательны, поэтому необязательный timestamp
 * описан как `string | null`; после ответа он сверяется с транскриптом
 * и null превращается в «нет поля» (см. normalize*).
 * ===================================================================== */

const timestamp = z
  .string()
  .nullable()
  .describe(
    'Таймкод из транскрипта ("мм:сс" или "чч:мм:сс", без скобок) — ровно как он записан в тексте; null, если в транскрипте нет таймкодов',
  );

export const SummarySectionSchema = z.object({
  heading: z.string().describe("Заголовок раздела конспекта"),
  timestamp: timestamp.describe("Таймкод строки транскрипта, где начинается этот раздел; null, если таймкодов нет"),
  points: z.array(z.string()).describe("Ключевые тезисы раздела"),
});

export const QuizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).describe("Ровно 4 варианта ответа"),
  correctIndex: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe("Индекс правильного варианта в options, от 0 до 3"),
  explanation: z
    .string()
    .describe("Почему правильный ответ верный, со ссылкой на объяснение в занятии"),
  timestamp: timestamp.describe("Таймкод строки транскрипта, где ментор объяснял эту тему; null, если таймкодов нет"),
});

export const HomeworkSchema = z.object({
  task: z.string().describe("Формулировка практического задания"),
  requirements: z.array(z.string()).describe("Что должно быть сделано"),
  criteria: z.array(z.string()).describe("Критерии проверки"),
});

export const FaqItemSchema = z.object({
  question: z.string().describe("Вопрос студента из транскрипта"),
  answer: z.string().describe("Ответ ментора из транскрипта"),
  timestamp: timestamp.describe("Таймкод строки транскрипта, где прозвучал вопрос; null, если таймкодов нет"),
});

export const GlossaryItemSchema = z.object({
  term: z.string().describe("Термин так, как он звучал на занятии"),
  kk: z.string().describe("На казахском"),
  ru: z.string().describe("На русском"),
  en: z.string().describe("На английском"),
  definition: z.string().describe("Короткое определение на языке материалов"),
});

/** Все материалы разом (первичная генерация). */
export const MaterialsResponseSchema = z.object({
  title: z.string().describe("Тема занятия"),
  summary: z.array(SummarySectionSchema),
  quiz: z.array(QuizQuestionSchema),
  homework: HomeworkSchema,
  faq: z.array(FaqItemSchema),
  glossary: z.array(GlossaryItemSchema),
});

export type MaterialsResponse = z.infer<typeof MaterialsResponseSchema>;

/* =====================================================================
 * 2. Блоки материалов — для вкладок и перегенерации одного блока.
 * ===================================================================== */

export const BLOCK_KEYS = ["summary", "quiz", "homework", "faq", "glossary"] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];

export const BLOCK_LABELS: Record<BlockKey, string> = {
  summary: "Конспект",
  quiz: "Тест",
  homework: "Домашка",
  faq: "FAQ",
  glossary: "Глоссарий",
};

/** Схемы ответа модели для одного блока (корень Structured Outputs — всегда объект). */
export const BlockResponseSchemas = {
  summary: z.object({ summary: z.array(SummarySectionSchema) }),
  quiz: z.object({ quiz: z.array(QuizQuestionSchema) }),
  homework: z.object({ homework: HomeworkSchema }),
  faq: z.object({ faq: z.array(FaqItemSchema) }),
  glossary: z.object({ glossary: z.array(GlossaryItemSchema) }),
} satisfies Record<BlockKey, z.ZodType>;

/* =====================================================================
 * 3. Типы материалов в приложении (как в PROJECT.MD).
 * ===================================================================== */

export type SummarySection = { heading: string; timestamp?: string; points: string[] };

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  timestamp?: string;
};

export type Homework = { task: string; requirements: string[]; criteria: string[] };
export type FaqItem = { question: string; answer: string; timestamp?: string };
export type GlossaryItem = { term: string; kk: string; ru: string; en: string; definition: string };

export type Materials = {
  title: string;
  summary: SummarySection[];
  quiz: QuizQuestion[];
  homework: Homework;
  faq: FaqItem[];
  glossary: GlossaryItem[];
};

/* =====================================================================
 * 4. Приведение ответа модели к типам приложения.
 *  - таймкоды сверяются с транскриптом (marks): несуществующий заменяется
 *    на ближайший существующий; если таймкодов в транскрипте нет — поле убирается;
 *  - вопросы теста с некорректной структурой отбрасываются.
 * ===================================================================== */

function withTimestamp<T extends { timestamp: string | null }>(item: T, marks: TimecodeMark[]) {
  const { timestamp, ...rest } = item;
  const snapped = snapTimecode(timestamp, marks);
  return snapped ? { ...rest, timestamp: snapped } : rest;
}

type RawBlocks = Pick<MaterialsResponse, BlockKey>;

export function normalizeBlock<K extends BlockKey>(
  block: K,
  raw: RawBlocks[K],
  marks: TimecodeMark[],
): Materials[K] {
  const ts = <T extends { timestamp: string | null }>(item: T) => withTimestamp(item, marks);
  switch (block) {
    case "summary":
      return (raw as RawBlocks["summary"]).map(ts) as Materials[K];
    case "quiz":
      return (raw as RawBlocks["quiz"])
        .filter((q) => q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4)
        .map(ts) as Materials[K];
    case "faq":
      return (raw as RawBlocks["faq"]).map(ts) as Materials[K];
    default:
      return raw as Materials[K];
  }
}

export function normalizeMaterials(raw: MaterialsResponse, marks: TimecodeMark[]): Materials {
  return {
    title: raw.title,
    summary: normalizeBlock("summary", raw.summary, marks),
    quiz: normalizeBlock("quiz", raw.quiz, marks),
    homework: raw.homework,
    faq: normalizeBlock("faq", raw.faq, marks),
    glossary: raw.glossary,
  };
}

/* =====================================================================
 * 5. Валидация материалов из редактора ментора — с сообщениями на русском.
 * ===================================================================== */

const required = (message: string) => z.string().trim().min(1, message);

const editorTimestamp = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .refine((v) => parseTimecode(v) !== null, "Таймкод — в формате мм:сс или чч:мм:сс")
    .optional(),
);

export const MaterialsSchema = z.object({
  title: required("Укажите тему занятия"),
  summary: z.array(
    z.object({
      heading: required("Укажите заголовок раздела"),
      timestamp: editorTimestamp,
      points: z.array(required("Тезис не может быть пустым")).min(1, "Добавьте хотя бы один тезис"),
    }),
  ),
  quiz: z.array(
    z.object({
      question: required("Введите текст вопроса"),
      options: z.array(required("Вариант ответа не может быть пустым")).length(4, "Нужно ровно 4 варианта"),
      correctIndex: z.number().int().min(0).max(3, "Выберите правильный ответ"),
      explanation: required("Добавьте объяснение"),
      timestamp: editorTimestamp,
    }),
  ),
  homework: z.object({
    task: required("Опишите задание"),
    requirements: z.array(required("Требование не может быть пустым")),
    criteria: z.array(required("Критерий не может быть пустым")),
  }),
  faq: z.array(
    z.object({
      question: required("Введите вопрос"),
      answer: required("Введите ответ"),
      timestamp: editorTimestamp,
    }),
  ),
  glossary: z.array(
    z.object({
      term: required("Укажите термин"),
      kk: z.string().trim(),
      ru: z.string().trim(),
      en: z.string().trim(),
      definition: required("Добавьте определение"),
    }),
  ),
}) satisfies z.ZodType<Materials>;

const FIELD_LABELS: Record<string, string> = {
  title: "Тема",
  summary: "Конспект · раздел",
  quiz: "Тест · вопрос",
  homework: "Домашка",
  faq: "FAQ · вопрос",
  glossary: "Глоссарий · термин",
  points: "тезис",
  options: "вариант",
  requirements: "требование",
  criteria: "критерий",
};

/** Ошибки zod → понятные строки: «Тест · вопрос 3 · вариант 2: Вариант ответа не может быть пустым». */
export function formatIssues(error: z.ZodError): string[] {
  const messages = error.issues.map((issue) => {
    const parts: string[] = [];
    for (let i = 0; i < issue.path.length; i++) {
      const key = issue.path[i];
      if (typeof key === "number") continue;
      const label = FIELD_LABELS[String(key)];
      if (!label) continue;
      const next = issue.path[i + 1];
      parts.push(typeof next === "number" ? `${label} ${next + 1}` : label);
    }
    return parts.length ? `${parts.join(" · ")}: ${issue.message}` : issue.message;
  });
  return [...new Set(messages)];
}

/* =====================================================================
 * 6. Занятие (хранилище) и запросы к API.
 * ===================================================================== */

export const LANGUAGES = {
  ru: "Русский",
  kk: "Қазақша",
} as const;

export type Language = keyof typeof LANGUAGES;
const LanguageSchema = z.enum(["ru", "kk"]);

export const LESSON_STATUSES = ["draft", "published"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const LessonSchema = z.object({
  editId: z.string(), // секретный — для ментора
  slug: z.string(), // публичный — для студентов
  status: z.enum(LESSON_STATUSES),
  materials: MaterialsSchema,
  transcript: z.string(), // обезличенный
  recordingUrl: z.string().nullable(),
  language: LanguageSchema,
  mock: z.boolean(), // сгенерировано в демо-режиме
  // Даты — ISO-строки
  startedAt: z.string(), // ментор загрузил/вставил транскрипт
  createdAt: z.string(),
  generatedAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(), // текущая публикация
  firstPublishedAt: z.string().nullable(),
  /** Старая метрика: время по часам от загрузки транскрипта до первой публикации, мс. Оставлена для совместимости. */
  prepDurationMs: z.number().nullable(),
  /**
   * Активное время ментора (вкладка видима, действие не дольше 5 минут назад), мс.
   * Копится до первой публикации, потом не меняется. null — занятие создано до появления этого учёта.
   */
  activePrepMs: z.number().nonnegative().nullable().default(null),
});

export type Lesson = z.infer<typeof LessonSchema>;

/** Что видит студент: без транскрипта и секретного editId. */
export type PublicLesson = {
  slug: string;
  materials: Materials;
  recordingUrl: string | null;
  publishedAt: string | null;
};

/** Ограничения на транскрипт — общие для клиента и сервера. */
export const TRANSCRIPT_MIN_LENGTH = 200;
export const TRANSCRIPT_MAX_LENGTH = 150_000; // ≈ 2 часа речи

const RecordingUrlSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "Ссылка на запись должна начинаться с http:// или https://");

export const GenerateRequestSchema = z.object({
  transcript: z.string(),
  language: LanguageSchema,
  recordingUrl: RecordingUrlSchema,
  /** Когда ментор загрузил/вставил транскрипт (мс, Date.now() в браузере). */
  startedAt: z.number().optional(),
  /** Активное время на главной до отправки (мс), см. lib/active-time.ts. */
  activeMs: z.number().optional(),
});

export type GenerateResponse =
  | { ok: true; editId: string; mock: boolean }
  | { ok: false; error: string };

export const SaveLessonRequestSchema = z.object({
  materials: MaterialsSchema,
  recordingUrl: RecordingUrlSchema,
});

export const RegenerateRequestSchema = z.object({ block: z.enum(BLOCK_KEYS) });

export type ApiError = { ok: false; error: string; issues?: string[] };
