// Удаление занятий через API, статистика без демо, учёт активного времени
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { ActiveTimeTracker, IDLE_MS, MAX_ACTIVITY_CHUNK_MS, sanitizeActiveMs } from "./active-time.ts";
import { SESSION_COOKIE, createSessionToken } from "./auth.ts";
import { deleteLessonApi, deleteLessonsApi, MAX_BULK_DELETE, type ApiDeps } from "./lesson-api.ts";
import { addActiveTime, lessonStats, prepTimeMs, publishLesson } from "./lessons.ts";
import { sampleInput } from "./storage-contract.ts";
import { JsonFileLessonStorage, type CreateLessonInput } from "./storage.ts";

const MIN = 60_000;
const PASSWORD = "pilot-pass";
const env = { MENTOR_PASSWORD: PASSWORD, NODE_ENV: "production" };
const SECRET = `jazba:${PASSWORD}`; // как в resolveAuthConfig без SESSION_SECRET

let dir: string;
let storage: JsonFileLessonStorage;
let deps: ApiDeps;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "jazba-api-"));
  storage = new JsonFileLessonStorage(dir);
  deps = { storage, env };
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const create = (over: Partial<CreateLessonInput> = {}) => storage.create(sampleInput(over));

async function request(url: string, { session = true, body }: { session?: boolean; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (session) headers.cookie = `${SESSION_COOKIE}=${await createSessionToken(SECRET)}`;
  return new Request(`http://localhost${url}`, {
    method: "DELETE",
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("удаление занятий (API)", () => {
  it("одно занятие: удаляется, повтор — 404", async () => {
    const lesson = await create();
    const keep = await create();
    const res = await deleteLessonApi(await request(`/api/lessons/${lesson.editId}`), lesson.editId, deps);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, deleted: [lesson.editId] });
    assert.equal(await storage.get(lesson.editId), null);
    assert.ok(await storage.get(keep.editId));

    const again = await deleteLessonApi(await request(`/api/lessons/${lesson.editId}`), lesson.editId, deps);
    assert.equal(again.status, 404);
  });

  it("массовое: удаляет выбранные, остальные не трогает", async () => {
    const [a, b, keep] = [await create(), await create(), await create()];
    const res = await deleteLessonsApi(
      await request("/api/lessons", { body: { editIds: [a.editId, b.editId, "Z".repeat(32)] } }),
      deps,
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual([...data.deleted].sort(), [a.editId, b.editId].sort());
    assert.deepEqual((await storage.list()).map((l) => l.editId), [keep.editId]);
  });

  it("массовое: пустой или слишком большой список, мусор в теле — 400", async () => {
    const bodies = [{ editIds: [] }, { editIds: Array(MAX_BULK_DELETE + 1).fill("x") }, { ids: [] }, "{не json"];
    for (const body of bodies) {
      const res = await deleteLessonsApi(await request("/api/lessons", { body }), deps);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
    }
  });

  it("без входа — 401, и ничего не удаляется", async () => {
    const lesson = await create();
    const one = await deleteLessonApi(
      await request(`/api/lessons/${lesson.editId}`, { session: false }),
      lesson.editId,
      deps,
    );
    assert.equal(one.status, 401);
    const many = await deleteLessonsApi(
      await request("/api/lessons", { session: false, body: { editIds: [lesson.editId] } }),
      deps,
    );
    assert.equal(many.status, 401);
    assert.ok(await storage.get(lesson.editId));
  });

  it("поддельная cookie и продакшен без пароля — 401", async () => {
    const lesson = await create();
    const forged = new Request(`http://localhost/api/lessons/${lesson.editId}`, {
      method: "DELETE",
      headers: { cookie: `${SESSION_COOKIE}=${await createSessionToken("чужой-секрет")}` },
    });
    assert.equal((await deleteLessonApi(forged, lesson.editId, deps)).status, 401);

    const noPassword = { storage, env: { NODE_ENV: "production" } };
    const res = await deleteLessonApi(await request(`/api/lessons/${lesson.editId}`), lesson.editId, noPassword);
    assert.equal(res.status, 401);
    assert.ok(await storage.get(lesson.editId));
  });
});

describe("статистика без демо-занятий", () => {
  type Row = Parameters<typeof lessonStats>[0][number];
  const row = (over: Partial<Row>): Row => ({
    mock: false,
    status: "draft",
    firstPublishedAt: null,
    activePrepMs: null,
    prepDurationMs: null,
    ...over,
  });
  const published = { status: "published" as const, firstPublishedAt: "2026-11-09T10:00:00.000Z" };

  it("демо не влияет на количество, опубликованные и среднее время", () => {
    const stats = lessonStats([
      row({ ...published, activePrepMs: 10 * MIN, prepDurationMs: 40 * MIN }),
      row({ ...published, activePrepMs: 20 * MIN }),
      row({}),
      row({ mock: true, ...published, activePrepMs: 1 * MIN }),
      row({ mock: true }),
    ]);
    assert.deepEqual(stats, { count: 3, published: 2, averagePrepMs: 15 * MIN });
  });

  it("только демо — пустая статистика", () => {
    assert.deepEqual(lessonStats([row({ mock: true, ...published, activePrepMs: MIN })]), {
      count: 0,
      published: 0,
      averagePrepMs: null,
    });
  });

  it("время подготовки: активное, иначе старое; до публикации — нет", () => {
    assert.equal(prepTimeMs(row({ ...published, activePrepMs: 5 * MIN, prepDurationMs: 50 * MIN })), 5 * MIN);
    assert.equal(prepTimeMs(row({ ...published, prepDurationMs: 50 * MIN })), 50 * MIN, "старое занятие");
    assert.equal(prepTimeMs(row({ activePrepMs: 5 * MIN })), null, "ещё не опубликовано");
  });
});

describe("активное время", () => {
  it("идёт, пока ментор действует; простой дольше 5 минут не считается", () => {
    const t = new ActiveTimeTracker(0);
    assert.equal(t.read(2 * MIN), 2 * MIN);
    t.activity(3 * MIN);
    // После действия в 3 мин время идёт ещё 5 мин (до 8 мин), дальше — простой
    assert.equal(t.read(30 * MIN), 8 * MIN);
    t.activity(40 * MIN); // вернулся: простой 8–40 мин не засчитан
    assert.equal(t.read(41 * MIN), 9 * MIN);
  });

  it("скрытая вкладка не считается, даже если действие было недавно", () => {
    const t = new ActiveTimeTracker(0);
    t.setVisible(false, 1 * MIN);
    assert.equal(t.read(4 * MIN), 1 * MIN);
    t.setVisible(true, 4 * MIN); // вернулся на вкладку
    assert.equal(t.read(5 * MIN), 2 * MIN, "окно 5 минут от последнего действия ещё не прошло");
    assert.equal(t.read(9 * MIN), 2 * MIN, "дальше — простой");
    t.activity(9 * MIN);
    assert.equal(t.read(10 * MIN), 3 * MIN);
  });

  it("вкладка скрыта с самого начала — ничего не копится", () => {
    const t = new ActiveTimeTracker(0, { visible: false });
    t.activity(MIN);
    assert.equal(t.read(3 * MIN), 0);
  });

  it("take забирает накопленное, restore возвращает", () => {
    const t = new ActiveTimeTracker(0);
    assert.equal(t.take(MIN), MIN);
    assert.equal(t.read(2 * MIN), MIN, "после take считает заново");
    t.restore(30_000);
    assert.equal(t.read(2 * MIN), MIN + 30_000);
  });

  it("IDLE_MS — 5 минут; значения из браузера проверяются", () => {
    assert.equal(IDLE_MS, 5 * MIN);
    assert.equal(sanitizeActiveMs(-5, 100), 0);
    assert.equal(sanitizeActiveMs("10", 100), 0);
    assert.equal(sanitizeActiveMs(Number.NaN, 100), 0);
    assert.equal(sanitizeActiveMs(Infinity, 100), 0);
    assert.equal(sanitizeActiveMs(500, 100), 100);
    assert.equal(sanitizeActiveMs(42.4, 100), 42);
  });

  it("копится до первой публикации, потом заморожено", async () => {
    const lesson = await create({ activePrepMs: 3 * MIN });
    assert.equal((await addActiveTime(storage, lesson.editId, 2 * MIN))?.activePrepMs, 5 * MIN);
    assert.equal((await addActiveTime(storage, lesson.editId, -1))?.activePrepMs, 5 * MIN, "мусор игнорируется");
    assert.equal(
      (await addActiveTime(storage, lesson.editId, 10 * 60 * MIN))?.activePrepMs,
      5 * MIN + MAX_ACTIVITY_CHUNK_MS,
      "слишком большой кусок обрезается",
    );

    const published = await publishLesson(storage, lesson.editId, new Date(), MIN);
    const total = 6 * MIN + MAX_ACTIVITY_CHUNK_MS;
    assert.equal(published?.activePrepMs, total, "неотправленное время уходит вместе с публикацией");
    assert.equal(prepTimeMs(published!), total);

    assert.equal((await addActiveTime(storage, lesson.editId, MIN))?.activePrepMs, total, "после публикации не растёт");
    const again = await publishLesson(storage, lesson.editId, new Date(), MIN);
    assert.equal(again?.activePrepMs, total, "повторная публикация не меняет метрику");
  });

  it("старые занятия без активного времени: не копят, показывают старую метрику", async () => {
    const lesson = await create({ startedAt: new Date("2026-11-09T10:00:00Z") });
    assert.equal(lesson.activePrepMs, null);
    assert.equal((await addActiveTime(storage, lesson.editId, MIN))?.activePrepMs, null);
    const published = await publishLesson(storage, lesson.editId, new Date("2026-11-09T10:14:00Z"), MIN);
    assert.equal(published?.activePrepMs, null);
    assert.equal(prepTimeMs(published!), 14 * MIN);
  });

  it("неизвестное занятие — null", async () => {
    assert.equal(await addActiveTime(storage, "Z".repeat(32), MIN), null);
  });
});
