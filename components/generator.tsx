"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { VttState } from "@/components/input/vtt-input";
import { useActiveTime } from "@/components/use-active-time";
import { TranscriptForm, type InputMode } from "@/components/transcript-form";
import { isValidRecordingUrl } from "@/lib/recording";
import {
  TRANSCRIPT_MAX_LENGTH,
  TRANSCRIPT_MIN_LENGTH,
  type GenerateResponse,
  type Language,
} from "@/lib/schema";
import { buildTranscript } from "@/lib/vtt";

/**
 * Новое занятие: подготовка транскрипта → /api/generate → занятие сохраняется
 * черновиком, и ментор попадает в редактор.
 */
export function Generator({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>("vtt") // в дизайне первым идёт файл из Zoom;
  const [text, setText] = useState("");
  const [vtt, setVtt] = useState<VttState | null>(null);
  const [mentor, setMentor] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("ru");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Метрика «подготовлено за N мин»: момент, когда ментор впервые вставил/загрузил транскрипт
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const markStarted = () => setStartedAt((t) => t ?? Date.now());
  // Активное время ментора с момента загрузки транскрипта (см. lib/active-time.ts)
  const activeTime = useActiveTime(startedAt !== null);

  // Транскрипт из .vtt с псевдонимами вместо имён. Пока ментор не выбран — null:
  // без этого нельзя отличить студентов от ментора, и ничего не отправляем.
  const vttTranscript = useMemo(() => {
    if (!vtt) return null;
    const needsMentor = vtt.parsed.speakers.length > 0;
    if (needsMentor && !mentor) return null;
    return buildTranscript(vtt.parsed, mentor);
  }, [vtt, mentor]);

  /** Текст для отправки или сообщение об ошибке. */
  function prepare(): { transcript: string } | { error: string } {
    if (mode === "vtt") {
      if (!vtt) return { error: "Загрузите .vtt-файл с транскриптом занятия." };
      if (vttTranscript === null) return { error: "Выберите себя в списке спикеров — так мы поймём, кто студенты." };
    }
    const transcript = (mode === "vtt" ? vttTranscript ?? "" : text).trim();
    const length = transcript.length;
    if (length === 0) return { error: "Вставьте транскрипт занятия." };
    if (length < TRANSCRIPT_MIN_LENGTH)
      return { error: `Транскрипт слишком короткий — нужно хотя бы ${TRANSCRIPT_MIN_LENGTH} символов.` };
    if (length > TRANSCRIPT_MAX_LENGTH)
      return {
        error: `Транскрипт слишком длинный: ${length.toLocaleString("ru-RU")} символов при максимуме ${TRANSCRIPT_MAX_LENGTH.toLocaleString("ru-RU")}. Сократите текст или разделите занятие на части.`,
      };
    if (recordingUrl.trim() && !isValidRecordingUrl(recordingUrl))
      return { error: "Ссылка на запись должна начинаться с http:// или https:// — исправьте её или очистите поле." };
    return { transcript };
  }

  async function handleSubmit() {
    const prepared = prepare();
    if ("error" in prepared) {
      setError(prepared.error);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: prepared.transcript,
          language,
          recordingUrl: recordingUrl.trim() || null,
          startedAt: startedAt ?? Date.now(),
          activeMs: activeTime.read(),
        }),
      });
      const data = (await res.json().catch(() => null)) as GenerateResponse | null;

      if (!data) {
        setError(`Сервер вернул неожиданный ответ (код ${res.status}). Попробуйте ещё раз.`);
      } else if (!data.ok) {
        setError(data.error);
      } else {
        router.push(`/lessons/${data.editId}`); // черновик сохранён — в редактор
        return; // индикатор загрузки остаётся до перехода
      }
    } catch {
      setError("Нет связи с сервером. Проверьте, что приложение запущено, и попробуйте снова.");
    }
    setLoading(false);
  }

  async function handleLoadTextSample() {
    try {
      const res = await fetch("/api/sample?kind=text");
      if (!res.ok) throw new Error();
      setText(await res.text());
      markStarted();
      setError(null);
    } catch {
      setError("Не удалось загрузить пример транскрипта.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {demo && (
        <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm leading-relaxed font-semibold text-sun-ink">
          Демо-режим: ИИ не используется — для любого транскрипта создаётся занятие с готовыми
          материалами к примеру js-arrays-lesson.vtt. Чтобы включить ИИ, задайте AI_PROVIDER и AI_API_KEY
          в .env.local и уберите MOCK_GENERATION=true.
        </p>
      )}
      <TranscriptForm
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setError(null);
        }}
        text={text}
        onTextChange={(value) => {
          setText(value);
          if (value.trim()) markStarted();
        }}
        onLoadTextSample={handleLoadTextSample}
        vtt={vtt}
        onVttChange={(next) => {
          setVtt(next);
          if (next) markStarted();
          setMentor(null); // новый файл — новый выбор ментора
          setError(null);
        }}
        mentor={mentor}
        onMentorChange={(name) => {
          setMentor(name);
          setError(null);
        }}
        vttTranscript={vttTranscript}
        language={language}
        onLanguageChange={setLanguage}
        recordingUrl={recordingUrl}
        onRecordingUrlChange={setRecordingUrl}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
      />
    </div>
  );
}
