// Редактор и тест студента: операции со списками, валидация, темы для повторения
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { moveItem, removeAt, replaceAt } from "./list.ts";
import { reviewTopics } from "./review.ts";
import { formatIssues, MaterialsSchema, type Materials } from "./schema.ts";

const mock: Materials = JSON.parse(
  readFileSync(new URL("../samples/mock-materials.json", import.meta.url), "utf8"),
);

describe("операции со списками", () => {
  it("moveItem сдвигает и не выходит за границы", () => {
    assert.deepEqual(moveItem(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
    const list = ["a", "b"];
    assert.equal(moveItem(list, 0, -1), list);
    assert.equal(moveItem(list, 1, 1), list);
  });

  it("replaceAt / removeAt не меняют исходный массив", () => {
    const list = ["a", "b", "c"];
    assert.deepEqual(replaceAt(list, 1, "x"), ["a", "x", "c"]);
    assert.deepEqual(removeAt(list, 0), ["b", "c"]);
    assert.deepEqual(list, ["a", "b", "c"]);
  });
});

describe("валидация материалов из редактора", () => {
  it("мок-материалы проходят", () => {
    assert.ok(MaterialsSchema.safeParse(mock).success);
  });

  it("пустой таймкод допустим, кривой — нет", () => {
    const ok = { ...mock, summary: [{ ...mock.summary[0], timestamp: "" }] };
    assert.ok(MaterialsSchema.safeParse(ok).success);
    const bad = { ...mock, summary: [{ ...mock.summary[0], timestamp: "12 минут" }] };
    assert.ok(!MaterialsSchema.safeParse(bad).success);
  });

  it("понятные сообщения с указанием места", () => {
    const bad = {
      ...mock,
      quiz: mock.quiz.map((q, i) => (i === 2 ? { ...q, options: ["a", "", "c", "d"] } : q)),
    };
    const result = MaterialsSchema.safeParse(bad);
    assert.ok(!result.success);
    if (result.success) return;
    assert.deepEqual(formatIssues(result.error), [
      "Тест · вопрос 3 · вариант 2: Вариант ответа не может быть пустым",
    ]);
  });

  it("в вопросе ровно 4 варианта", () => {
    const bad = { ...mock, quiz: [{ ...mock.quiz[0], options: ["a", "b", "c"] }] };
    assert.ok(!MaterialsSchema.safeParse(bad).success);
  });
});

describe("итоги теста: что пересмотреть", () => {
  it("все верно — тем нет", () => {
    const answers = mock.quiz.map((q) => q.correctIndex);
    assert.deepEqual(reviewTopics(mock.quiz, answers, mock.summary), []);
  });

  it("ошибки → разделы конспекта с таймкодами, без повторов", () => {
    // Вопрос 1 (03:46) и вопрос 2 (02:47) — оба в разделе «Типичная ошибка…» (02:47)
    // Вопрос 7 (09:32) — раздел «Начальное значение в reduce»
    const wrong = (i: number) => (mock.quiz[i].correctIndex + 1) % 4;
    const answers = mock.quiz.map((q, i) => ([0, 1, 6].includes(i) ? wrong(i) : q.correctIndex));
    assert.deepEqual(reviewTopics(mock.quiz, answers, mock.summary), [
      { title: "Типичная ошибка: callback ничего не возвращает", timestamp: "03:46" },
      { title: "Начальное значение в reduce", timestamp: "09:32" },
    ]);
  });

  it("без таймкодов — сам вопрос", () => {
    const quiz = [{ ...mock.quiz[0], timestamp: undefined }];
    assert.deepEqual(reviewTopics(quiz, [3], []), [{ title: mock.quiz[0].question }]);
  });
});
