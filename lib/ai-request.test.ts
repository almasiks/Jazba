// Запрос к ИИ: параметры, повторы и таймаут (сеть подменена, ключ — фиктивный)
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import OpenAI from "openai";
import { generationErrorResponse } from "./api-errors.ts";
import { generateBlock } from "./generation.ts";
import { AiTimeoutError, withDeadline } from "./openai.ts";

const ENV = { AI_PROVIDER: "gemini", AI_API_KEY: "test-key", AI_MODEL: "gemini-3.8-flash", MOCK_GENERATION: "false" };
const saved = { ...process.env };

const completion = () =>
  Response.json({
    id: "1",
    object: "chat.completion",
    created: 0,
    model: ENV.AI_MODEL,
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '{"faq":[]}' } }],
  });

describe("запрос к ИИ", () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});
  });
  afterEach(() => {
    mock.restoreAll();
    for (const key of Object.keys(ENV)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("Gemini: минимум размышлений (reasoning_effort=low)", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => completion());
    assert.deepEqual(await generateBlock("faq", "Ментор: тема", "ru"), []);
    const body = JSON.parse(String(fetchMock.mock.calls[0].arguments[1]?.body));
    assert.equal(body.reasoning_effort, "low");
    assert.equal(body.response_format.type, "json_schema");
  });

  it("после ошибки сервера — ровно один повтор", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      Response.json({ error: { message: "overloaded" } }, { status: 503, headers: { "retry-after-ms": "1" } }),
    );
    await assert.rejects(generateBlock("faq", "Ментор: тема", "ru"), OpenAI.APIError);
    assert.equal(fetchMock.mock.callCount(), 2);
  });

  it("общий срок прерывает зависший запрос", async () => {
    let aborted = false;
    const hang = withDeadline((signal) => {
      signal.addEventListener("abort", () => (aborted = true));
      return new Promise<never>(() => {});
    }, 20);
    await assert.rejects(hang, AiTimeoutError);
    assert.equal(aborted, true);
  });

  it("таймаут → понятное сообщение, а не «не удалось связаться»", async () => {
    for (const error of [new AiTimeoutError(), new OpenAI.APIConnectionTimeoutError()]) {
      const response = generationErrorResponse(error);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: "Модель отвечает слишком долго, попробуйте ещё раз." });
    }
  });
});
