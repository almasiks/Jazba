"use client";

import { useEffect, useRef, useState } from "react";
import { ActiveTimeTracker } from "@/lib/active-time";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart", "input"] as const;

export type ActiveTime = {
  /** Сколько накоплено, мс. */
  read: () => number;
  /** Забрать накопленное (для отправки) и обнулить. */
  take: () => number;
  /** Вернуть то, что не удалось отправить. */
  restore: (ms: number) => void;
};

/**
 * Считает активное время ментора, пока enabled: вкладка видима и было действие
 * не дольше 5 минут назад (см. lib/active-time.ts). Отсчёт начинается при включении.
 */
export function useActiveTime(enabled: boolean): ActiveTime {
  const tracker = useRef<ActiveTimeTracker | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const current = new ActiveTimeTracker(Date.now(), { visible: document.visibilityState === "visible" });
    tracker.current = current;

    const onActivity = () => current.activity(Date.now());
    const onVisibility = () => current.setVisible(document.visibilityState === "visible", Date.now());
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  // Ссылки на функции стабильны: читают текущий трекер из ref
  const [api] = useState<ActiveTime>(() => ({
    read: () => tracker.current?.read(Date.now()) ?? 0,
    take: () => tracker.current?.take(Date.now()) ?? 0,
    restore: (ms) => tracker.current?.restore(ms),
  }));
  return api;
}
