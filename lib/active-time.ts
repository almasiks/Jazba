/**
 * Учёт активного времени ментора для метрики «подготовлено за N мин».
 *
 * Время идёт, только пока вкладка видима И ментор что-то делал (клик, клавиша,
 * прокрутка, движение мыши) не дольше IDLE_MS назад. Простой дольше IDLE_MS
 * и скрытая вкладка не считаются.
 *
 * Чистый класс без DOM — время передаётся снаружи, поэтому его легко проверить тестами.
 */

export const IDLE_MS = 5 * 60_000;

/**
 * Максимум, который сервер примет за одну отправку из редактора.
 * Браузер отправляет накопленное каждые ~30 секунд, так что больше — это ошибка или подделка.
 */
export const MAX_ACTIVITY_CHUNK_MS = 15 * 60_000;

export class ActiveTimeTracker {
  private total = 0;
  private lastTick: number;
  private lastActivity: number | null;
  private visible: boolean;
  private readonly idleMs: number;

  constructor(now: number, options: { visible?: boolean; active?: boolean; idleMs?: number } = {}) {
    this.lastTick = now;
    this.visible = options.visible ?? true;
    this.lastActivity = options.active === false ? null : now; // начало работы — само по себе действие
    this.idleMs = options.idleMs ?? IDLE_MS;
  }

  /** Засчитывает отрезок [lastTick, now] в той части, что попадает в окно активности. */
  private advance(now: number) {
    if (now <= this.lastTick) return;
    if (this.visible && this.lastActivity !== null) {
      const end = Math.min(now, this.lastActivity + this.idleMs);
      if (end > this.lastTick) this.total += end - this.lastTick;
    }
    this.lastTick = now;
  }

  /** Ментор что-то сделал. */
  activity(now: number) {
    this.advance(now);
    this.lastActivity = now;
  }

  /** Вкладку скрыли или показали. Возврат на вкладку сам по себе не считается действием. */
  setVisible(visible: boolean, now: number) {
    this.advance(now);
    this.visible = visible;
  }

  /** Сколько накоплено (мс). */
  read(now: number): number {
    this.advance(now);
    return this.total;
  }

  /** Забрать накопленное для отправки на сервер и обнулить счётчик. */
  take(now: number): number {
    const value = Math.round(this.read(now));
    this.total = 0;
    return value;
  }

  /** Вернуть время, которое не удалось отправить. */
  restore(ms: number) {
    this.total += ms;
  }
}

/** Значение из браузера → безопасное число мс (мусор и отрицательное → 0). */
export function sanitizeActiveMs(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), max);
}
