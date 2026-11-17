"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimecode } from "@/lib/timecode";
import type { ParsedVtt } from "@/lib/vtt";

export type VttState = { fileName: string; parsed: ParsedVtt };

function speakersLabel(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} спикер`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} спикера`;
  return `${n} спикеров`;
}

/** Загруженный .vtt: имя файла, длительность, число спикеров и «Заменить файл». */
export function VttFileCard({ vtt, onReplace, disabled }: { vtt: VttState; onReplace: () => void; disabled?: boolean }) {
  const { parsed, fileName } = vtt;
  const duration = formatTimecode(parsed.duration, parsed.duration >= 3600);

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[18px] border-2 border-dashed border-brand-line bg-surface-soft p-4">
      <span className="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-brand-soft text-brand" aria-hidden>
        <FileText className="size-[26px]" strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="truncate text-[17px] font-extrabold">{fileName}</span>
        <span className="text-[15px] font-semibold text-muted-foreground">
          Длительность {duration} · {parsed.cues.length} реплик
          {parsed.speakers.length > 0 && ` · найдено ${speakersLabel(parsed.speakers.length)}`}
        </span>
      </div>
      <Button type="button" variant="outline" onClick={onReplace} disabled={disabled}>
        Заменить файл
      </Button>
    </div>
  );
}
