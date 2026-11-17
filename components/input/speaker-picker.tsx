"use client";

import { useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildAliases } from "@/lib/vtt";
import type { VttState } from "./vtt-input";

const AVATAR_COLORS = ["bg-sun", "bg-[#ddf6f4]", "bg-[#fde7ef]", "bg-[#ffeedf]", "bg-brand-soft"];

/** «Ерлан Сапаров» → «ЕС», «Данияр» → «ДА». */
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}

type Props = {
  vtt: VttState;
  mentor: string | null;
  onMentorChange: (name: string) => void;
  /** Готовый текст для модели (null — пока ментор не выбран). */
  transcript: string | null;
  disabled?: boolean;
};

/**
 * Спикеры из .vtt: ментор выбирает себя, остальные станут «Студент 1, 2, 3»
 * до отправки в OpenAI. Ниже — превью того, что уйдёт в ИИ.
 */
export function SpeakerPicker({ vtt, mentor, onMentorChange, transcript, disabled }: Props) {
  const aliases = useMemo(() => buildAliases(vtt.parsed.cues, mentor), [vtt, mentor]);

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-base leading-normal text-muted-foreground">
        Остальные спикеры станут «Студент 1, 2, 3» — их настоящие имена не уйдут в ИИ.
      </p>

      <fieldset disabled={disabled} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="sr-only">Выберите себя</legend>
        {vtt.parsed.speakers.map((speaker, i) => {
          const checked = speaker.name === mentor;
          return (
            <label
              key={speaker.name}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card p-3.5 shadow-press transition-colors hover:bg-surface-soft",
                checked && "border-brand bg-brand-soft shadow-[0_3px_0_var(--color-brand)] hover:bg-brand-soft",
              )}
            >
              <input
                type="radio"
                name="mentor"
                value={speaker.name}
                checked={checked}
                onChange={() => onMentorChange(speaker.name)}
                className="size-5 shrink-0 accent-brand"
              />
              <span
                className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-black", AVATAR_COLORS[i % AVATAR_COLORS.length])}
                aria-hidden
              >
                {initials(speaker.name)}
              </span>
              <span className="min-w-0 flex-1 truncate font-extrabold">{speaker.name}</span>
              {checked ? (
                <span className="rounded-full bg-brand px-2.5 py-1 text-[13px] font-black text-white">Это я</span>
              ) : mentor ? (
                <span className="text-[13px] font-extrabold text-muted-foreground">→ {aliases.get(speaker.name)}</span>
              ) : (
                <span className="text-[13px] font-bold text-muted-foreground tabular-nums">{speaker.cueCount} репл.</span>
              )}
            </label>
          );
        })}
      </fieldset>

      {transcript !== null && (
        <details className="group rounded-2xl border-2 border-ok-line bg-ok-soft p-4">
          <summary className="cursor-pointer font-extrabold text-ok-ink">
            Показать, что уйдёт в ИИ
          </summary>
          <Textarea
            readOnly
            value={transcript}
            aria-label="Подготовленный транскрипт"
            className="mt-3 max-h-80 min-h-48 border-ok-line font-mono text-xs"
          />
          <p className="mt-2 text-xs font-semibold text-[#22543d]">
            Реплики склеены в блоки по ~30 секунд с таймкодами. Если имя студента прозвучало в речи в необычной
            форме, проверьте текст выше.
          </p>
        </details>
      )}
    </div>
  );
}
