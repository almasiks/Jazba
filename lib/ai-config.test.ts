// Выбор ИИ-провайдера (OpenAI / Gemini / OpenRouter) и демо-режим
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigError, DEFAULT_AI_MODELS, resolveAiConfig } from "./config.ts";
import { isMockMode } from "./mock.ts";

describe("ИИ-провайдер", () => {
  it("по умолчанию — OpenAI со старыми переменными", () => {
    assert.deepEqual(resolveAiConfig({ OPENAI_API_KEY: "sk-1", OPENAI_MODEL: "gpt-x" }), {
      provider: "openai",
      apiKey: "sk-1",
      model: "gpt-x",
    });
    assert.deepEqual(resolveAiConfig({}), { provider: "openai", apiKey: null, model: DEFAULT_AI_MODELS.openai });
  });

  it("Gemini через AI_PROVIDER / AI_API_KEY / AI_MODEL", () => {
    assert.deepEqual(
      resolveAiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "AIza1", AI_MODEL: "gemini-2.5-flash" }),
      { provider: "gemini", apiKey: "AIza1", model: "gemini-2.5-flash" },
    );
    assert.equal(resolveAiConfig({ AI_PROVIDER: "Gemini", AI_API_KEY: "k" }).model, DEFAULT_AI_MODELS.gemini);
  });

  it("без AI_PROVIDER: только GEMINI_API_KEY → gemini", () => {
    assert.equal(resolveAiConfig({ GEMINI_API_KEY: "AIza1" }).provider, "gemini");
    assert.equal(resolveAiConfig({ GEMINI_API_KEY: "AIza1", OPENAI_API_KEY: "sk-1" }).provider, "openai");
  });

  it("ключ OpenAI не уходит в Gemini и наоборот", () => {
    assert.equal(resolveAiConfig({ AI_PROVIDER: "gemini", OPENAI_API_KEY: "sk-1" }).apiKey, null);
    assert.equal(resolveAiConfig({ AI_PROVIDER: "openai", GEMINI_API_KEY: "AIza1" }).apiKey, null);
  });

  it("пробелы и кавычки вокруг значений убираются", () => {
    const config = resolveAiConfig({ AI_PROVIDER: ' "gemini" ', AI_API_KEY: " 'AIza1' ", AI_MODEL: "  " });
    assert.deepEqual(config, { provider: "gemini", apiKey: "AIza1", model: DEFAULT_AI_MODELS.gemini });
  });

  it("OpenRouter: явно, по ключу sk-or- и по OPENROUTER_API_KEY", () => {
    assert.deepEqual(resolveAiConfig({ AI_PROVIDER: "openrouter", AI_API_KEY: "sk-or-v1-x" }), {
      provider: "openrouter",
      apiKey: "sk-or-v1-x",
      model: DEFAULT_AI_MODELS.openrouter,
    });
    // ключ OpenRouter нигде больше не работает — даже при AI_PROVIDER=gemini
    assert.equal(resolveAiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "sk-or-v1-x" }).provider, "openrouter");
    assert.equal(resolveAiConfig({ OPENROUTER_API_KEY: "sk-or-v1-x" }).provider, "openrouter");
  });

  it("OpenRouter: модель без владельца получает префикс", () => {
    const model = (AI_MODEL: string) => resolveAiConfig({ AI_API_KEY: "sk-or-v1-x", AI_MODEL }).model;
    assert.equal(model("gemini-3.8-flash"), "google/gemini-3.8-flash");
    assert.equal(model("gpt-5-mini"), "openai/gpt-5-mini");
    assert.equal(model("anthropic/claude-sonnet-5-5"), "anthropic/claude-sonnet-5-5");
  });

  it("неизвестный провайдер — понятная ошибка", () => {
    assert.throws(() => resolveAiConfig({ AI_PROVIDER: "claude" }), ConfigError);
  });

  it("демо-режим: нет ключа или MOCK_GENERATION=true", () => {
    assert.equal(isMockMode({}), true);
    assert.equal(isMockMode({ AI_PROVIDER: "gemini", AI_API_KEY: "AIza1" }), false);
    assert.equal(isMockMode({ AI_PROVIDER: "gemini", AI_API_KEY: "AIza1", MOCK_GENERATION: "true" }), true);
    assert.equal(isMockMode({ OPENAI_API_KEY: "sk-1" }), false);
    assert.equal(isMockMode({ AI_PROVIDER: "claude", AI_API_KEY: "k" }), false, "ошибку настроек не прячем за демо");
  });
});
