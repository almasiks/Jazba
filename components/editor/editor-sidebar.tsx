"use client";

import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BlockIcon, BLOCK_STYLE } from "@/components/block-style";
import { RecordingLinkField } from "@/components/input/recording-link-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { BLOCK_KEYS, BLOCK_LABELS, type BlockKey, type LessonStatus } from "@/lib/schema";
import { cn } from "@/lib/utils";

const card = "flex flex-col gap-3 rounded-[22px] border-2 border-border bg-card p-[18px] shadow-card";

/** Меню блоков материалов с количеством элементов. */
export function BlockNav({
  active,
  counts,
  onSelect,
}: {
  active: BlockKey;
  counts: Record<BlockKey, number>;
  onSelect: (block: BlockKey) => void;
}) {
  return (
    <nav aria-label="Блоки материалов" className="flex flex-col gap-1 rounded-[22px] border-2 border-border bg-card p-2.5 shadow-card">
      {BLOCK_KEYS.map((block) => {
        const isActive = block === active;
        return (
          <button
            key={block}
            type="button"
            aria-current={isActive ? "true" : undefined}
            onClick={() => onSelect(block)}
            className={cn(
              "flex min-h-[52px] items-center gap-3 rounded-[14px] border-2 border-transparent px-3 text-left text-base font-extrabold transition-colors hover:bg-surface-soft",
              isActive && cn("font-black", BLOCK_STYLE[block].active),
            )}
          >
            <BlockIcon block={block} size="sm" className={isActive ? BLOCK_STYLE[block].solid : undefined} />
            <span className="flex-1">{BLOCK_LABELS[block]}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{counts[block]}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function RecordingCard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className={card}>
      <RecordingLinkField value={value} onChange={onChange} label={<span className="font-black">Запись занятия</span>} id="editor-recording-url" />
    </div>
  );
}

/** Ссылка для студентов: после публикации — копировать / открыть; до — подсказка. */
export function StudentLinkCard({ slug, status }: { slug: string; status: LessonStatus }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `/s/${slug}`;

  if (status !== "published") {
    return (
      <div className="flex flex-col gap-1.5 rounded-[22px] border-2 border-dashed border-[#d6d1ec] bg-card p-[18px]">
        <span className="font-black">Ссылка для студентов</span>
        <span className="text-sm font-semibold text-muted-foreground">Появится после публикации</span>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Скопируйте вручную: ${window.location.origin}${path}`);
    }
  }

  return (
    <div className={cn(card, "border-ok-line bg-ok-soft shadow-[0_5px_0_var(--color-ok-line)]")}>
      <span className="font-black text-ok-ink">Ссылка для студентов</span>
      <code className="truncate rounded-xl bg-card px-3 py-2 font-mono text-sm font-bold text-ok-ink">{path}</code>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Скопировано" : "Скопировать"}
        </Button>
        <Link href={path} target="_blank" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ExternalLink data-icon="inline-start" />
          Открыть
        </Link>
      </div>
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}

/** Удаление занятия с подтверждением в два шага. */
export function DeleteLesson({ editId }: { editId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/lessons/${editId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.push("/lessons");
    } else {
      setBusy(false);
      setError("Не удалось удалить занятие.");
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-[22px] border-2 border-bad-line bg-bad-soft p-[18px]">
        <span className="font-black text-bad-ink">Удалить занятие навсегда?</span>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
            Удалить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Отмена
          </Button>
        </div>
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      </div>
    );
  }
  return (
    <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} className="w-fit text-muted-foreground">
      <Trash2 data-icon="inline-start" />
      Удалить занятие
    </Button>
  );
}
