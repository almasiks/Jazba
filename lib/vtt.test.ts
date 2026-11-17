// Тесты парсера .vtt. Запуск: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  anonymizeText,
  buildAliases,
  buildTranscript,
  mergeCues,
  parseVtt,
  parseVttTime,
  VttParseError,
} from "./vtt.ts";

const sample = readFileSync(new URL("../samples/js-arrays-lesson.vtt", import.meta.url), "utf8");
const MENTOR = "Ерлан Сапаров";
const STUDENTS = ["Айгерим Нурланова", "Данияр Ахметов", "Мария Ким"];

describe("parseVttTime", () => {
  it("разбирает чч:мм:сс.ммм и мм:сс.ммм", () => {
    assert.equal(parseVttTime("00:01:23.450"), 83.45);
    assert.equal(parseVttTime("01:02:03.000"), 3723);
    assert.equal(parseVttTime("01:23.450"), 83.45);
    assert.equal(parseVttTime("00:00:05,500"), 5.5);
  });
});

describe("parseVtt на примере из samples/", () => {
  const parsed = parseVtt(sample);

  it("находит все реплики", () => {
    assert.equal(parsed.cues.length, 81);
    assert.equal(parsed.cues[0].start, 1.2);
    assert.match(parsed.cues[0].text, /^Так, всем сәлеметсіздер ме!/);
  });

  it("отделяет спикера от текста", () => {
    assert.equal(parsed.cues[0].speaker, MENTOR);
    assert.ok(!parsed.cues[0].text.startsWith(MENTOR));
  });

  it("находит 1 ментора и 3 студентов, ментор говорит больше всех", () => {
    assert.deepEqual(
      parsed.speakers.map((s) => s.name).sort(),
      [MENTOR, ...STUDENTS].sort(),
    );
    assert.equal(parsed.speakers[0].name, MENTOR);
  });

  it("считает длительность занятия ~15 минут", () => {
    assert.ok(parsed.duration > 14 * 60 && parsed.duration < 16 * 60);
  });

  it("не режет код с двоеточиями и точками", () => {
    assert.ok(parsed.cues.some((c) => c.text.includes("prices.map(price => price * 1.12)")));
  });
});

describe("parseVtt: особые случаи", () => {
  it("пропускает номера реплик, NOTE, теги и пустой текст; работает с CRLF и BOM", () => {
    const vtt =
      "﻿WEBVTT\r\n\r\nNOTE комментарий\r\n\r\n1\r\n00:00:01.000 --> 00:00:03.000 align:start\r\n<v Иван Петров>Привет</v>\r\n\r\n2\r\n00:00:04.000 --> 00:00:05.000\r\n\r\n";
    const parsed = parseVtt(vtt);
    assert.equal(parsed.cues.length, 1);
    assert.equal(parsed.cues[0].speaker, "Иван Петров");
    assert.equal(parsed.cues[0].text, "Привет");
  });

  it("не принимает «Пример: …» за спикера (одно слово, один раз)", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
Пример: const a = 1

00:00:03.000 --> 00:00:04.000
Без спикера вообще`;
    const parsed = parseVtt(vtt);
    assert.equal(parsed.cues[0].speaker, null);
    assert.equal(parsed.cues[0].text, "Пример: const a = 1");
    assert.equal(parsed.speakers.length, 0);
  });

  it("бросает понятную ошибку на пустом и не-vtt файле", () => {
    assert.throws(() => parseVtt(""), VttParseError);
    assert.throws(() => parseVtt("просто текст\nбез таймкодов"), VttParseError);
  });
});

describe("mergeCues", () => {
  const cue = (start: number, speaker: string | null, text: string) => ({
    start,
    end: start + 2,
    speaker,
    text,
  });

  it("склеивает реплики одного спикера в пределах 30 секунд", () => {
    const blocks = mergeCues([cue(0, "A", "раз"), cue(10, "A", "два"), cue(29, "A", "три")]);
    assert.deepEqual(blocks, [{ start: 0, speaker: "A", text: "раз два три" }]);
  });

  it("начинает новый блок после 30 секунд и при смене спикера", () => {
    const blocks = mergeCues([cue(0, "A", "раз"), cue(31, "A", "два"), cue(35, "B", "вопрос")]);
    assert.equal(blocks.length, 3);
    assert.equal(blocks[1].start, 31);
    assert.equal(blocks[2].speaker, "B");
  });

  it("делает транскрипт заметно короче на примере", () => {
    const parsed = parseVtt(sample);
    assert.ok(mergeCues(parsed.cues).length < parsed.cues.length * 0.8);
  });
});

describe("анонимизация", () => {
  const parsed = parseVtt(sample);

  it("ментор → «Ментор», студенты → «Студент N» по порядку появления", () => {
    const aliases = buildAliases(parsed.cues, MENTOR);
    assert.equal(aliases.get(MENTOR), "Ментор");
    assert.equal(aliases.get("Мария Ким"), "Студент 1"); // заговорила первой
    assert.equal(aliases.get("Айгерим Нурланова"), "Студент 2");
    assert.equal(aliases.get("Данияр Ахметов"), "Студент 3");
  });

  it("заменяет имена внутри текста, включая падежи", () => {
    const aliases = new Map([["Данияр Ахметов", "Студент 1"]]);
    assert.equal(anonymizeText("Данияр, давай ты. Спасибо Данияру!", aliases), "Студент 1, давай ты. Спасибо Студент 1!");
  });

  it("в итоговом транскрипте нет настоящих имён студентов", () => {
    const text = buildTranscript(parsed, MENTOR);
    for (const name of STUDENTS) {
      for (const word of name.split(" ")) assert.ok(!text.includes(word), `осталось «${word}»`);
    }
    assert.ok(!text.includes("Ерлан"));
  });

  it("формат строк: [мм:сс] Спикер: текст", () => {
    const lines = buildTranscript(parsed, MENTOR).split("\n");
    assert.match(lines[0], /^\[00:01\] Ментор: Так, всем сәлеметсіздер ме!/);
    assert.ok(lines.every((l) => /^\[\d{2}:\d{2}\] (Ментор|Студент \d): /.test(l)));
  });

  it("для занятий длиннее часа — [чч:мм:сс]", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
Иван Петров: начало

01:00:05.000 --> 01:00:06.000
Иван Петров: конец`;
    const lines = buildTranscript(parseVtt(vtt), "Иван Петров").split("\n");
    assert.equal(lines[0], "[00:00:01] Ментор: начало");
    assert.equal(lines[1], "[01:00:05] Ментор: конец");
  });
});
