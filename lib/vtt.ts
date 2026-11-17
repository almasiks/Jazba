/**
 * Парсер WEBVTT-транскриптов Zoom и подготовка текста для модели.
 *
 * Пример реплики Zoom:
 *   12
 *   00:01:23.450 --> 00:01:27.100
 *   Имя Спикера: текст
 *
 * Модуль без зависимостей (импорт с .ts — чтобы тесты запускались через node --test).
 */
import { formatTimecode } from "./timecode.ts";

export type Cue = {
  start: number; // секунды
  end: number;
  speaker: string | null;
  text: string;
};

export type Speaker = { name: string; cueCount: number };

export type ParsedVtt = {
  cues: Cue[];
  speakers: Speaker[]; // по убыванию числа реплик
  duration: number; // секунды
};

export class VttParseError extends Error {}

const TIME_LINE =
  /^\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/;

/** "00:01:23.450" или "01:23.450" → секунды. */
export function parseVttTime(value: string): number {
  const parts = value.replace(",", ".").split(":").map(Number);
  return parts.reduce((acc, part) => acc * 60 + part, 0);
}

// Похоже на имя: 1–4 слова с заглавной буквы, без цифр и знаков препинания.
const NAME_LIKE = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){0,3}$/u;

/** Разбирает текст .vtt-файла. Бросает VttParseError с понятным сообщением. */
export function parseVtt(source: string): ParsedVtt {
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!text.trim()) throw new VttParseError("Файл пустой.");

  const rawCues: { start: number; end: number; text: string; voice: string | null }[] = [];

  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const timeIndex = lines.findIndex((l) => TIME_LINE.test(l));
    if (timeIndex === -1) continue; // заголовок WEBVTT, NOTE, STYLE и т.п.

    const [, from, to] = lines[timeIndex].match(TIME_LINE)!;
    let body = lines.slice(timeIndex + 1).join(" ").trim();

    // Голосовой тег WebVTT: <v Имя>текст</v>
    const voice = body.match(/^<v(?:\.[^\s>]+)?\s+([^>]+)>/)?.[1]?.trim() ?? null;
    body = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!body) continue;

    rawCues.push({ start: parseVttTime(from), end: parseVttTime(to), text: body, voice });
  }

  if (rawCues.length === 0) {
    throw new VttParseError(
      "Не нашли ни одной реплики. Похоже, это не .vtt-файл с транскриптом Zoom.",
    );
  }

  // Префикс «Имя: » считаем спикером, если он похож на имя и встречается
  // хотя бы дважды или состоит из 2+ слов — чтобы не принять «Пример: …» за спикера.
  const prefixOf = (t: string) => t.match(/^([^:]{1,60}):\s+(.+)$/);
  const counts = new Map<string, number>();
  for (const cue of rawCues) {
    const m = prefixOf(cue.text);
    if (m && NAME_LIKE.test(m[1].trim())) {
      const name = m[1].trim();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const isSpeaker = (name: string) =>
    (counts.get(name) ?? 0) >= 2 || name.split(/\s+/).length >= 2;

  const cues: Cue[] = rawCues.map((cue) => {
    if (cue.voice) return { start: cue.start, end: cue.end, speaker: cue.voice, text: cue.text };
    const m = prefixOf(cue.text);
    if (m && isSpeaker(m[1].trim())) {
      return { start: cue.start, end: cue.end, speaker: m[1].trim(), text: m[2].trim() };
    }
    return { start: cue.start, end: cue.end, speaker: null, text: cue.text };
  });

  cues.sort((a, b) => a.start - b.start);

  const speakerCounts = new Map<string, number>();
  for (const cue of cues) {
    if (cue.speaker) speakerCounts.set(cue.speaker, (speakerCounts.get(cue.speaker) ?? 0) + 1);
  }
  const speakers = [...speakerCounts.entries()]
    .map(([name, cueCount]) => ({ name, cueCount }))
    .sort((a, b) => b.cueCount - a.cueCount);

  return { cues, speakers, duration: Math.max(...cues.map((c) => c.end)) };
}

export type Block = { start: number; speaker: string | null; text: string };

/**
 * Склеивает подряд идущие реплики одного спикера в блоки не длиннее ~30 секунд.
 * Новый блок начинается, когда меняется спикер или блок стал длиннее окна.
 */
export function mergeCues(cues: Cue[], windowSeconds = 30): Block[] {
  const blocks: Block[] = [];
  for (const cue of cues) {
    const last = blocks.at(-1);
    if (last && last.speaker === cue.speaker && cue.start - last.start < windowSeconds) {
      last.text += " " + cue.text;
    } else {
      blocks.push({ start: cue.start, speaker: cue.speaker, text: cue.text });
    }
  }
  return blocks;
}

/**
 * Псевдонимы спикеров: ментор → «Ментор», остальные → «Студент 1», «Студент 2»…
 * (по порядку первого появления в записи).
 */
export function buildAliases(cues: Cue[], mentor: string | null): Map<string, string> {
  const aliases = new Map<string, string>();
  let studentNumber = 0;
  for (const cue of cues) {
    if (!cue.speaker || aliases.has(cue.speaker)) continue;
    aliases.set(
      cue.speaker,
      cue.speaker === mentor ? "Ментор" : `Студент ${++studentNumber}`,
    );
  }
  return aliases;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Заменяет имена спикеров внутри текста реплик («Айгерим, хороший вопрос»)
 * на их псевдонимы. Ищем полное имя и отдельные слова имени от 3 букв;
 * для слов от 4 букв допускаем падежное окончание до 2 букв («Данияру»).
 * Это «лучшее усилие»: ментор видит итоговый текст перед отправкой.
 */
export function anonymizeText(text: string, aliases: Map<string, string>): string {
  const patterns: { regex: RegExp; alias: string }[] = [];
  for (const [name, alias] of aliases) {
    patterns.push({ regex: new RegExp(`(?<!\\p{L})${escapeRegExp(name)}(?!\\p{L})`, "gu"), alias });
  }
  for (const [name, alias] of aliases) {
    for (const word of name.split(/\s+/)) {
      if (word.length < 3) continue;
      const suffix = word.length >= 4 ? "\\p{L}{0,2}" : "";
      patterns.push({
        regex: new RegExp(`(?<!\\p{L})${escapeRegExp(word)}${suffix}(?!\\p{L})`, "gu"),
        alias,
      });
    }
  }
  return patterns.reduce((acc, { regex, alias }) => acc.replace(regex, alias), text);
}

/**
 * Готовый транскрипт для модели: строки "[мм:сс] Спикер: текст"
 * (для занятий длиннее часа — "[чч:мм:сс]"), имена заменены на псевдонимы.
 */
export function buildTranscript(
  parsed: ParsedVtt,
  mentor: string | null,
  windowSeconds = 30,
): string {
  const aliases = buildAliases(parsed.cues, mentor);
  const long = parsed.duration >= 3600;
  return mergeCues(parsed.cues, windowSeconds)
    .map((block) => {
      const time = `[${formatTimecode(block.start, long)}]`;
      const speaker = block.speaker ? `${aliases.get(block.speaker)}: ` : "";
      return `${time} ${speaker}${anonymizeText(block.text, aliases)}`;
    })
    .join("\n");
}
