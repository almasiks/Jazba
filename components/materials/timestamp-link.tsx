"use client";

import { ExternalLink, Play } from "lucide-react";
import { useRecordingUrl } from "@/components/recording-context";
import { buildTimecodeLink } from "@/lib/recording";
import { cn } from "@/lib/utils";

/**
 * Таймкод материала («таблетка» с иконкой воспроизведения):
 * - без ссылки на запись — просто метка «12:34»;
 * - YouTube — ссылка, открывает видео с нужной секунды;
 * - другая запись — ссылка на запись и подсказка «перемотай на 12:34».
 * variant="button" — крупная кнопка «Пересмотри с …» после неверного ответа.
 */
export function TimestampLink({
  value,
  prefix,
  variant = "pill",
}: {
  value?: string;
  prefix?: string;
  variant?: "pill" | "button";
}) {
  const recordingUrl = useRecordingUrl();
  if (!value) return null;

  const label = prefix ? `${prefix} ${value}` : value;
  const link = recordingUrl ? buildTimecodeLink(recordingUrl, value) : null;
  const style =
    variant === "button"
      ? "min-h-11 gap-2 rounded-xl border-2 border-bad-line bg-card px-3.5 font-black text-brand-dark"
      : "gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 font-mono text-sm font-bold text-brand-dark tabular-nums";
  const Icon = link && !link.seeks ? ExternalLink : Play;
  const icon = <Icon className={cn("size-3.5 shrink-0", Icon === Play && "fill-current")} aria-hidden />;

  if (!link) {
    return (
      <span className={cn("inline-flex w-fit items-center", style)}>
        {icon}
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("inline-flex w-fit items-center no-underline transition-colors hover:bg-brand hover:text-white", style)}
        title={link.seeks ? `Открыть запись на ${value}` : "Открыть запись"}
      >
        {icon}
        {label}
      </a>
      {!link.seeks && <span className="text-xs font-semibold text-muted-foreground">перемотай на {value}</span>}
    </span>
  );
}
