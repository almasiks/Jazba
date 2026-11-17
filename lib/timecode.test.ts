import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getYouTubeId, buildTimecodeLink } from "./recording.ts";
import { extractTimecodes, formatTimecode, parseTimecode, snapTimecode } from "./timecode.ts";

describe("таймкоды", () => {
  it("форматирует и разбирает", () => {
    assert.equal(formatTimecode(83), "01:23");
    assert.equal(formatTimecode(3723), "62:03");
    assert.equal(formatTimecode(3723, true), "01:02:03");
    assert.equal(parseTimecode("34:12"), 2052);
    assert.equal(parseTimecode("[01:02:03]"), 3723);
    assert.equal(parseTimecode("12:75"), null);
    assert.equal(parseTimecode("около минуты"), null);
    assert.equal(parseTimecode(null), null);
  });

  it("достаёт таймкоды из транскрипта", () => {
    const marks = extractTimecodes("[00:01] a\n[02:30] b\n[00:01] c");
    assert.deepEqual(marks, [
      { seconds: 1, label: "00:01" },
      { seconds: 150, label: "02:30" },
    ]);
  });

  it("заменяет несуществующий таймкод на ближайший", () => {
    const marks = extractTimecodes("[00:10] a\n[01:00] b\n[05:00] c");
    assert.equal(snapTimecode("01:00", marks), "01:00");
    assert.equal(snapTimecode("01:20", marks), "01:00");
    assert.equal(snapTimecode("04:00", marks), "05:00");
    assert.equal(snapTimecode("99:00", marks), "05:00");
    assert.equal(snapTimecode(null, marks), undefined);
    assert.equal(snapTimecode("01:00", []), undefined); // в тексте нет таймкодов
  });
});

describe("ссылка на запись", () => {
  it("узнаёт YouTube в разных форматах", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://youtube.com/live/${id}`,
      `https://m.youtube.com/watch?v=${id}&t=5`,
    ]) {
      assert.equal(getYouTubeId(url), id, url);
    }
    assert.equal(getYouTubeId("https://zoom.us/rec/share/abc"), null);
  });

  it("YouTube — переход на нужную секунду, другие — просто на запись", () => {
    assert.deepEqual(buildTimecodeLink("https://youtu.be/dQw4w9WgXcQ", "34:12"), {
      href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2052s",
      seeks: true,
    });
    assert.deepEqual(buildTimecodeLink("https://zoom.us/rec/share/abc", "34:12"), {
      href: "https://zoom.us/rec/share/abc",
      seeks: false,
    });
    assert.equal(buildTimecodeLink("не ссылка", "34:12"), null);
  });
});
