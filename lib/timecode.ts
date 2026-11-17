/**
 * Таймкоды: "мм:сс" или "чч:мм:сс".
 * Модуль без зависимостей — используется и на клиенте, и на сервере, и в тестах.
 */

/** Секунды → "мм:сс" (или "чч:мм:сс", если long = true). */
export function formatTimecode(totalSeconds: number, long = false): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return long
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours * 60 + minutes)}:${pad(seconds)}`;
}

/** "мм:сс" / "чч:мм:сс" (можно в квадратных скобках) → секунды, или null. */
export function parseTimecode(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^\[?(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\]?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  const seconds = Number(s);
  if (seconds >= 60) return null;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + seconds;
}

export type TimecodeMark = { seconds: number; label: string };

/** Все таймкоды вида "[мм:сс]" / "[чч:мм:сс]" из транскрипта, по возрастанию, без повторов. */
export function extractTimecodes(transcript: string): TimecodeMark[] {
  const marks = new Map<number, string>();
  for (const match of transcript.matchAll(/\[((?:\d{1,2}:)?\d{1,3}:\d{2})\]/g)) {
    const seconds = parseTimecode(match[1]);
    if (seconds !== null && !marks.has(seconds)) marks.set(seconds, match[1]);
  }
  return [...marks.entries()]
    .map(([seconds, label]) => ({ seconds, label }))
    .sort((a, b) => a.seconds - b.seconds);
}

/**
 * Приводит таймкод от модели к реально существующему в транскрипте:
 * точное совпадение — как есть, иначе — ближайший существующий.
 * Если в транскрипте таймкодов нет или значение не распознано — undefined.
 */
export function snapTimecode(
  value: string | null | undefined,
  marks: TimecodeMark[],
): string | undefined {
  if (marks.length === 0) return undefined;
  const seconds = parseTimecode(value);
  if (seconds === null) return undefined;

  let best = marks[0];
  for (const mark of marks) {
    if (Math.abs(mark.seconds - seconds) < Math.abs(best.seconds - seconds)) best = mark;
  }
  return best.label;
}
