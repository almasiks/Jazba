"use client";

import { useEffect, useMemo, useState } from "react";
import { formatIssues, SaveLessonRequestSchema, type Materials } from "@/lib/schema";

export type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "error";

type Content = { materials: Materials; recordingUrl: string | null };

const DEBOUNCE_MS = 800;

/**
 * Автосохранение редактора: проверяет данные через zod и, если всё корректно,
 * сохраняет через 0,8 с после последней правки. Некорректные данные не сохраняются —
 * вместо этого показываем список ошибок.
 */
export function useAutosave(editId: string, content: Content) {
  // Последняя успешно сохранённая версия (сравнение по ссылке на объект)
  const [savedContent, setSavedContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => SaveLessonRequestSchema.safeParse(content), [content]);
  const issues = useMemo(
    () => (validation.success ? [] : formatIssues(validation.error)),
    [validation],
  );

  useEffect(() => {
    if (content === savedContent || !validation.success) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/lessons/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(content),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.ok) {
          setSavedContent(content);
          setError(null);
        } else {
          setError(data?.error ?? `Не удалось сохранить (код ${res.status}).`);
        }
      } catch {
        if (!cancelled) setError("Нет связи с сервером — изменения пока не сохранены.");
      } finally {
        setSaving(false); // даже если запрос устарел — новый запрос поставит флаг заново
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [editId, content, savedContent, validation.success]);

  let status: SaveStatus = "saved";
  if (!validation.success) status = "invalid";
  else if (saving) status = "saving";
  else if (error) status = "error";
  else if (content !== savedContent) status = "pending";

  // Предупреждаем при закрытии вкладки, если что-то не сохранено
  useEffect(() => {
    if (status === "saved") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return { status, issues, error };
}
