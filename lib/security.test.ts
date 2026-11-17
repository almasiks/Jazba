// Вход ментора, правила доступа, настройки окружения, ограничение частоты
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideAccess } from "./access-rules.ts";
import {
  checkPassword,
  createSessionToken,
  readCookie,
  safeNextPath,
  SESSION_TTL_MS,
  verifySessionToken,
} from "./auth.ts";
import { ConfigError, resolveAuthConfig, resolveRateLimits, resolveStorageKind, resolveSupabaseConfig } from "./config.ts";
import { checkGenerationLimit, MemoryRateLimiter } from "./rate-limit.ts";

const EDIT_ID = "Ab-_".repeat(8); // 32 символа
const SLUG = "abcde12345";

describe("сессия ментора", () => {
  it("свой токен проходит, чужой секрет — нет", async () => {
    const token = await createSessionToken("secret");
    assert.equal(await verifySessionToken(token, "secret"), true);
    assert.equal(await verifySessionToken(token, "other"), false);
  });

  it("подделка и мусор не проходят", async () => {
    const token = await createSessionToken("secret");
    const [expires, sig] = token.split(".");
    assert.equal(await verifySessionToken(`${Number(expires) + 1000}.${sig}`, "secret"), false);
    assert.equal(await verifySessionToken(`${expires}.${sig.slice(0, -1)}x`, "secret"), false);
    for (const bad of [undefined, "", "abc", "1.2.3", `${expires}.`]) {
      assert.equal(await verifySessionToken(bad, "secret"), false, String(bad));
    }
  });

  it("истекает через 30 дней", async () => {
    const now = Date.now();
    const token = await createSessionToken("secret", now);
    assert.equal(await verifySessionToken(token, "secret", now + SESSION_TTL_MS - 1), true);
    assert.equal(await verifySessionToken(token, "secret", now + SESSION_TTL_MS), false);
  });

  it("проверка пароля", async () => {
    assert.equal(await checkPassword("пароль-123", "пароль-123"), true);
    assert.equal(await checkPassword("пароль-12", "пароль-123"), false);
    assert.equal(await checkPassword("", "пароль-123"), false);
  });

  it("cookie и безопасный адрес возврата", () => {
    assert.equal(readCookie("a=1; jazba_session=x.y; b=2", "jazba_session"), "x.y");
    assert.equal(readCookie(null, "jazba_session"), undefined);
    assert.equal(safeNextPath(`/lessons/${EDIT_ID}`), `/lessons/${EDIT_ID}`);
    for (const evil of ["https://evil.com", "//evil.com", "/\\evil.com", "", null]) {
      assert.equal(safeNextPath(evil), "/lessons", String(evil));
    }
  });
});

describe("правила доступа (proxy)", () => {
  const anon = (path: string) => decideAccess(path, "password", false);
  const mentor = (path: string) => decideAccess(path, "password", true);

  it("страница студента открыта без входа", () => {
    assert.deepEqual(anon(`/s/${SLUG}`), { action: "allow" });
  });

  it("страницы ментора без входа → /login", () => {
    for (const path of ["/", "/lessons", `/lessons/${EDIT_ID}`]) {
      assert.deepEqual(anon(path), { action: "login", next: path });
    }
  });

  it("API ментора без входа → 401", () => {
    for (const path of ["/api/generate", `/api/lessons/${EDIT_ID}`, `/api/lessons/${EDIT_ID}/publish`, "/api/sample"]) {
      assert.deepEqual(anon(path), { action: "unauthorized" }, path);
    }
  });

  it("вход и выход доступны всегда", () => {
    for (const path of ["/login", "/api/login", "/api/logout"]) assert.deepEqual(anon(path), { action: "allow" });
  });

  it("slug НЕ открывает редактор даже после входа; editId не открывает страницу студента", () => {
    assert.deepEqual(mentor(`/lessons/${SLUG}`), { action: "not-found" });
    assert.deepEqual(mentor(`/lessons/${EDIT_ID}`), { action: "allow" });
    assert.deepEqual(anon(`/s/${EDIT_ID}`), { action: "not-found" });
    assert.deepEqual(anon(`/s/${SLUG}/extra`), { action: "not-found" });
  });

  it("без пароля: разработка — открыто, продакшен — закрыто", () => {
    assert.deepEqual(decideAccess("/lessons", "open", false), { action: "allow" });
    assert.deepEqual(decideAccess("/api/generate", "misconfigured", false), { action: "misconfigured" });
    assert.deepEqual(decideAccess("/lessons", "misconfigured", false), { action: "login", next: "/lessons" });
    assert.deepEqual(decideAccess(`/s/${SLUG}`, "misconfigured", false), { action: "allow" });
  });
});

describe("настройки окружения", () => {
  it("STORAGE: явное значение, авто-выбор, ошибки", () => {
    assert.equal(resolveStorageKind({}), "local");
    assert.equal(resolveStorageKind({ SUPABASE_URL: "https://x.supabase.co" }), "supabase");
    assert.equal(resolveStorageKind({ STORAGE: "local", SUPABASE_URL: "https://x" }), "local");
    assert.equal(resolveStorageKind({ STORAGE: "Supabase" }), "supabase");
    assert.throws(() => resolveStorageKind({ STORAGE: "mysql" }), ConfigError);
    assert.throws(() => resolveStorageKind({ STORAGE: "local", VERCEL: "1" }), ConfigError);
  });

  it("ключ service role не может быть NEXT_PUBLIC_*", () => {
    assert.throws(
      () => resolveSupabaseConfig({ SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "k" }),
      /попадёт в браузер/,
    );
    assert.throws(() => resolveSupabaseConfig({ SUPABASE_URL: "u" }), ConfigError);
    assert.deepEqual(resolveSupabaseConfig({ SUPABASE_URL: " u ", SUPABASE_SERVICE_ROLE_KEY: "k" }), {
      url: "u",
      serviceRoleKey: "k",
    });
  });

  it("MENTOR_PASSWORD", () => {
    assert.equal(resolveAuthConfig({ MENTOR_PASSWORD: "p" }).mode, "password");
    assert.equal(resolveAuthConfig({ NODE_ENV: "development" }).mode, "open");
    assert.equal(resolveAuthConfig({ NODE_ENV: "production" }).mode, "misconfigured");
    const a = resolveAuthConfig({ MENTOR_PASSWORD: "p1" });
    const b = resolveAuthConfig({ MENTOR_PASSWORD: "p2" });
    assert.ok(a.mode === "password" && b.mode === "password" && a.secret !== b.secret, "смена пароля меняет подпись");
  });

  it("лимиты: значения по умолчанию и мусор", () => {
    assert.deepEqual(resolveRateLimits({}), { perHour: 30, perMinute: 3 });
    assert.deepEqual(resolveRateLimits({ GENERATION_LIMIT_PER_HOUR: "100", GENERATION_LIMIT_PER_MINUTE: "-1" }), {
      perHour: 100,
      perMinute: 3,
    });
  });
});

describe("ограничение частоты", () => {
  it("скользящее окно", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(() => now);
    assert.equal(await limiter.consume("k", 2, 60), true);
    assert.equal(await limiter.consume("k", 2, 60), true);
    assert.equal(await limiter.consume("k", 2, 60), false);
    assert.equal(await limiter.consume("other", 2, 60), true, "ключи независимы");
    now = 60_001;
    assert.equal(await limiter.consume("k", 2, 60), true, "окно прошло");
  });

  it("генерация: лимит на IP в минуту и общий в час", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(() => now);
    const limits = { perHour: 4, perMinute: 2 };

    assert.equal((await checkGenerationLimit(limiter, "1.1.1.1", limits)).ok, true);
    assert.equal((await checkGenerationLimit(limiter, "1.1.1.1", limits)).ok, true);
    const third = await checkGenerationLimit(limiter, "1.1.1.1", limits);
    assert.equal(third.ok, false);
    assert.match(!third.ok ? third.message : "", /Подождите минуту/);

    assert.equal((await checkGenerationLimit(limiter, "2.2.2.2", limits)).ok, true);
    assert.equal((await checkGenerationLimit(limiter, "2.2.2.2", limits)).ok, true);
    now = 61_000;
    const hourly = await checkGenerationLimit(limiter, "3.3.3.3", limits);
    assert.equal(hourly.ok, false, "общий лимит 4 в час исчерпан");
    assert.match(!hourly.ok ? hourly.message : "", /4 в час/);
  });
});
