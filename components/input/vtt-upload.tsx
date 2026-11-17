"use client";

import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseVtt, VttParseError, type ParsedVtt } from "@/lib/vtt";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 МБ — это много часов текста

type Props = {
  onLoaded: (parsed: ParsedVtt, fileName: string) => void;
  disabled?: boolean;
};

/** Загрузка .vtt-файла (транскрипт Zoom): кнопка, drag-and-drop и пример. */
export function VttUpload({ onLoaded, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function load(text: string, fileName: string) {
    try {
      onLoaded(parseVtt(text), fileName);
      setError(null);
    } catch (e) {
      setError(e instanceof VttParseError ? e.message : "Не удалось разобрать файл.");
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vtt")) {
      setError("Нужен файл с расширением .vtt — транскрипт из Zoom (Recordings → Audio transcript).");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Файл слишком большой (больше 5 МБ).");
      return;
    }
    load(await file.text(), file.name);
  }

  async function handleSample() {
    try {
      const res = await fetch("/api/sample?kind=vtt");
      if (!res.ok) throw new Error();
      const name = decodeURIComponent(res.headers.get("X-Sample-File") ?? "sample.vtt");
      load(await res.text(), name);
    } catch {
      setError("Не удалось загрузить пример .vtt.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2.5 rounded-[18px] border-2 border-dashed border-brand-line bg-surface-soft px-6 py-9 text-center transition-colors hover:bg-brand-soft/60",
          dragOver && "border-brand bg-brand-soft",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="grid size-[52px] place-items-center rounded-[14px] bg-brand-soft text-brand" aria-hidden>
          <Upload className="size-[26px]" strokeWidth={2.2} />
        </span>
        <span className="text-[17px] font-extrabold">Перетащите .vtt-файл сюда или нажмите, чтобы выбрать</span>
        <span className="text-sm font-semibold text-muted-foreground">
          Транскрипт из Zoom: Recordings → запись → Audio transcript (.vtt)
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".vtt,text/vtt"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = ""; // чтобы можно было выбрать тот же файл ещё раз
          }}
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : <span />}
        <Button type="button" variant="ghost" size="sm" onClick={handleSample} disabled={disabled} className="text-brand">
          <FileText data-icon="inline-start" />
          Загрузить пример .vtt
        </Button>
      </div>
    </div>
  );
}
