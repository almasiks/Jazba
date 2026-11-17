/**
 * Итоги теста: какие темы стоит пересмотреть.
 * Тема — раздел конспекта, в который попадает таймкод вопроса с ошибкой;
 * если таймкодов нет — сам текст вопроса.
 */
import type { QuizQuestion, SummarySection } from "./schema.ts";
import { parseTimecode } from "./timecode.ts";

export type ReviewTopic = { title: string; timestamp?: string };

export function reviewTopics(
  questions: QuizQuestion[],
  answers: (number | null)[],
  sections: SummarySection[],
): ReviewTopic[] {
  const timedSections = sections
    .map((s) => ({ heading: s.heading, seconds: parseTimecode(s.timestamp) }))
    .filter((s): s is { heading: string; seconds: number } => s.seconds !== null)
    .sort((a, b) => a.seconds - b.seconds);

  const topics: ReviewTopic[] = [];
  const seen = new Set<string>();

  questions.forEach((q, i) => {
    if (answers[i] === null || answers[i] === undefined || answers[i] === q.correctIndex) return;

    const seconds = parseTimecode(q.timestamp);
    // Последний раздел, который начался не позже момента объяснения
    const section =
      seconds === null ? undefined : timedSections.filter((s) => s.seconds <= seconds).at(-1);
    const title = section?.heading ?? q.question;
    if (seen.has(title)) return;
    seen.add(title);
    topics.push(q.timestamp ? { title, timestamp: q.timestamp } : { title });
  });

  return topics;
}
