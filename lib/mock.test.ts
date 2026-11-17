// Проверка мок-материалов: формат и таймкоды, соответствующие примеру .vtt
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MaterialsResponseSchema } from "./schema.ts";
import { extractTimecodes } from "./timecode.ts";
import { buildTranscript, parseVtt } from "./vtt.ts";

const mock = JSON.parse(readFileSync(new URL("../samples/mock-materials.json", import.meta.url), "utf8"));
const vtt = readFileSync(new URL("../samples/js-arrays-lesson.vtt", import.meta.url), "utf8");
const transcriptMarks = new Set(
  extractTimecodes(buildTranscript(parseVtt(vtt), "Ерлан Сапаров")).map((m) => m.label),
);

describe("samples/mock-materials.json", () => {
  it("соответствует схеме Materials", () => {
    assert.doesNotThrow(() => MaterialsResponseSchema.parse(mock));
  });

  it("все таймкоды есть в транскрипте js-arrays-lesson.vtt", () => {
    const items = [...mock.summary, ...mock.quiz, ...mock.faq];
    for (const item of items) {
      assert.ok(transcriptMarks.has(item.timestamp), `нет таймкода ${item.timestamp}`);
    }
  });

  it("в тесте 5–10 вопросов по 4 варианта, правильные ответы на разных позициях", () => {
    assert.ok(mock.quiz.length >= 5 && mock.quiz.length <= 10);
    for (const q of mock.quiz) {
      assert.equal(q.options.length, 4);
      assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3);
    }
    assert.equal(new Set(mock.quiz.map((q: { correctIndex: number }) => q.correctIndex)).size, 4);
  });
});
