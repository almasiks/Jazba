"use client";

import { Input } from "@/components/ui/input";
import { getYouTubeId, isValidRecordingUrl } from "@/lib/recording";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Подпись поля; по умолчанию — «Ссылка на запись — необязательно». */
  label?: React.ReactNode;
  id?: string;
};

/** Необязательная ссылка на запись: таймкоды в материалах станут ссылками. */
export function RecordingLinkField({ value, onChange, disabled, label, id = "recording-url" }: Props) {
  const trimmed = value.trim();
  const invalid = trimmed !== "" && !isValidRecordingUrl(trimmed);
  const isYouTube = !invalid && trimmed !== "" && getYouTubeId(trimmed) !== null;

  let hint = "YouTube — таймкоды откроют видео с нужной секунды; другие ссылки — откроют запись.";
  if (invalid) hint = "Похоже, это не ссылка. Нужен адрес вида https://…";
  else if (isYouTube) hint = "Таймкоды в материалах будут открывать видео с нужной секунды.";
  else if (trimmed) hint = "Таймкоды откроют запись, а время будет показано рядом.";

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-extrabold">
        {label ?? (
          <>
            Ссылка на запись <span className="font-semibold text-muted-foreground">— необязательно</span>
          </>
        )}
      </label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        placeholder="https://youtube.com/watch?v=…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-hint`}
      />
      <p
        id={`${id}-hint`}
        className={cn("text-[13px] leading-snug font-semibold", invalid ? "text-destructive" : "text-muted-foreground")}
      >
        {hint}
      </p>
    </div>
  );
}
