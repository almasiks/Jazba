"use client";

import { FileText, Loader2, Sparkles } from "lucide-react";
import { RecordingLinkField } from "@/components/input/recording-link-field";
import { SpeakerPicker } from "@/components/input/speaker-picker";
import { VttFileCard, type VttState } from "@/components/input/vtt-input";
import { VttUpload } from "@/components/input/vtt-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, TRANSCRIPT_MAX_LENGTH, type Language } from "@/lib/schema";
import { cn } from "@/lib/utils";

export type InputMode = "text" | "vtt";

type Props = {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  // Режим «Текст»
  text: string;
  onTextChange: (value: string) => void;
  onLoadTextSample: () => void;
  // Режим «Файл .vtt»
  vtt: VttState | null;
  onVttChange: (vtt: VttState | null) => void;
  mentor: string | null;
  onMentorChange: (name: string) => void;
  vttTranscript: string | null;
  // Общее
  language: Language;
  onLanguageChange: (value: Language) => void;
  recordingUrl: string;
  onRecordingUrlChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
};

const MODES: { value: InputMode; label: string }[] = [
  { value: "vtt", label: "Файл .vtt из Zoom" },
  { value: "text", label: "Вставить текст" },
];

/** Форма нового занятия: пронумерованные шаги в одной карточке и большая кнопка «Сгенерировать». */
export function TranscriptForm(props: Props) {
  const { mode, vtt, loading, error } = props;
  const showSpeakers = mode === "vtt" && vtt !== null && vtt.parsed.speakers.length > 0;
  let step = 0;

  return (
    <form
      className="flex flex-col gap-[30px] rounded-3xl border-2 border-border bg-card p-5 shadow-card sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <Step n={++step} title="Транскрипт занятия">
        <div role="tablist" aria-label="Способ ввода" className="flex gap-1.5 rounded-2xl bg-track p-1.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={mode === m.value}
              disabled={loading}
              onClick={() => props.onModeChange(m.value)}
              className={cn(
                "min-h-11 flex-1 rounded-xl px-3 text-base font-extrabold text-muted-foreground transition-colors disabled:opacity-60",
                mode === m.value && "bg-card text-brand shadow-[0_2px_0_var(--border)]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "vtt" ? (
          vtt ? (
            <VttFileCard vtt={vtt} onReplace={() => props.onVttChange(null)} disabled={loading} />
          ) : (
            <VttUpload onLoaded={(parsed, fileName) => props.onVttChange({ parsed, fileName })} disabled={loading} />
          )
        ) : (
          <TextInput
            value={props.text}
            onChange={props.onTextChange}
            onLoadSample={props.onLoadTextSample}
            disabled={loading}
          />
        )}
      </Step>

      {showSpeakers && (
        <Step n={++step} title="Кто вы на записи?">
          <SpeakerPicker
            vtt={vtt}
            mentor={props.mentor}
            onMentorChange={props.onMentorChange}
            transcript={props.vttTranscript}
            disabled={loading}
          />
        </Step>
      )}

      <Step n={++step} title="Детали">
        <div className="flex flex-wrap gap-4">
          <div className="min-w-0 flex-[2_1_280px]">
            <RecordingLinkField value={props.recordingUrl} onChange={props.onRecordingUrlChange} disabled={loading} />
          </div>
          <LanguageToggle value={props.language} onChange={props.onLanguageChange} disabled={loading} />
        </div>
      </Step>

      <div className="flex flex-col gap-2.5">
        <Button type="submit" size="xl" disabled={loading} className="w-full">
          {loading ? (
            <Loader2 data-icon="inline-start" className="size-[22px] animate-spin" />
          ) : (
            <Sparkles data-icon="inline-start" className="size-[22px]" />
          )}
          {loading ? "Генерируем и сохраняем черновик…" : "Сгенерировать материалы"}
        </Button>
        <p className="text-center text-sm font-semibold text-muted-foreground" aria-live="polite">
          {loading
            ? "Обычно это занимает от 30 секунд до пары минут."
            : "Это черновик: вы проверите всё в редакторе перед публикацией"}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertTitle>Не получилось сгенерировать</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-black text-white" aria-hidden>
          {n}
        </span>
        <h2 className="text-[22px] font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TextInput({
  value,
  onChange,
  onLoadSample,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  disabled: boolean;
}) {
  const length = value.trim().length;
  const tooLong = length > TRANSCRIPT_MAX_LENGTH;

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        id="transcript"
        aria-label="Транскрипт занятия"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Вставьте сюда текст занятия — можно «как есть», с оговорками и смешением языков. Если в тексте есть таймкоды вида [12:34], они попадут в материалы."
        className="max-h-[60vh] min-h-64 font-mono text-sm"
        disabled={disabled}
        aria-invalid={tooLong || undefined}
      />
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onLoadSample} disabled={disabled} className="text-brand">
          <FileText data-icon="inline-start" />
          Вставить пример
        </Button>
        <span className={cn("text-xs font-semibold text-muted-foreground tabular-nums", tooLong && "text-destructive")}>
          {length.toLocaleString("ru-RU")} / {TRANSCRIPT_MAX_LENGTH.toLocaleString("ru-RU")} символов
        </span>
      </div>
    </div>
  );
}

function LanguageToggle({
  value,
  onChange,
  disabled,
}: {
  value: Language;
  onChange: (value: Language) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-2">
      <span id="language-label" className="text-[15px] font-extrabold">
        Язык материалов
      </span>
      <div role="group" aria-labelledby="language-label" className="flex gap-2">
        {(Object.keys(LANGUAGES) as Language[]).map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={value === code}
            onClick={() => onChange(code)}
            disabled={disabled}
            className={cn(
              "min-h-12 flex-1 rounded-[14px] border-2 border-border bg-card text-base font-extrabold text-muted-foreground transition-colors disabled:opacity-60",
              value === code && "border-brand bg-brand-soft text-brand",
            )}
          >
            {LANGUAGES[code]}
          </button>
        ))}
      </div>
    </div>
  );
}
