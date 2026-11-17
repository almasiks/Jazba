"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Заголовок блока в редакторе: название, количество, «Как видит студент», «Перегенерировать блок». */
export function BlockPanel({
  label,
  countLabel,
  hint,
  studentPath,
  regenerating,
  disabled,
  error,
  onRegenerate,
  children,
}: {
  label: string;
  countLabel: string;
  hint: string;
  studentPath: string;
  regenerating: boolean;
  disabled: boolean;
  error?: string;
  onRegenerate: () => void;
  children: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="flex min-w-0 flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[28px] font-black">{label}</h2>
          <span className="text-sm font-extrabold text-muted-foreground">{countLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href={studentPath} target="_blank" className={cn(buttonVariants({ variant: "ghost" }), "text-brand")}>
            Как видит студент
          </Link>
          {!confirming && (
            <Button variant="secondary" onClick={() => setConfirming(true)} disabled={disabled}>
              {regenerating ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" strokeWidth={2.4} />
              )}
              {regenerating ? "Генерируем…" : "Перегенерировать блок"}
            </Button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-quiz-line bg-quiz-soft px-4 py-3">
          <span className="flex-1 font-bold">Заменить блок «{label}» новым вариантом? Ваши правки в нём пропадут.</span>
          <Button
            size="sm"
            onClick={() => {
              setConfirming(false);
              onRegenerate();
            }}
          >
            Заменить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Отмена
          </Button>
        </div>
      )}

      <p className="text-[15px] font-semibold text-muted-foreground">{hint}</p>
      {error && <p className="font-bold text-destructive">Не удалось перегенерировать: {error}</p>}

      <div className={cn("flex flex-col", regenerating && "pointer-events-none opacity-50")} aria-busy={regenerating}>
        {children}
      </div>
    </section>
  );
}
