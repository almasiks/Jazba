"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PrintVariant } from "@/components/print/printable-materials";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { LessonStatus } from "@/lib/schema";
import { cn } from "@/lib/utils";
import type { ActiveTime } from "@/components/use-active-time";
import type { EditorLesson } from "./lesson-editor";
import type { SaveStatus } from "./use-autosave";

export type PublishState = {
  status: LessonStatus;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  prepDurationMs: number | null;
  activePrepMs: number | null;
};

type Props = {
  lesson: EditorLesson;
  title: string;
  onTitleChange: (title: string) => void;
  publish: PublishState;
  onPublishChange: (state: PublishState) => void;
  save: { status: SaveStatus; issues: string[]; error: string | null };
  onPrint: (variant: PrintVariant) => void;
  onError: (message: string | null) => void;
  /** Забрать ещё не отправленное активное время — уйдёт вместе с публикацией. */
  activeTime: ActiveTime;
};

/** Верхняя панель редактора: назад, тема и статус, «Сохранено», PDF и публикация. */
export function EditorHeader({ lesson, title, onTitleChange, publish, onPublishChange, save, onPrint, onError, activeTime }: Props) {
  const published = publish.status === "published";

  return (
    <header className="border-b-2 border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-4 px-6 py-3.5">
        <Link
          href="/lessons"
          aria-label="Назад к списку занятий"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0")}
        >
          <ArrowLeft strokeWidth={2.4} />
        </Link>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Textarea
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              aria-label="Тема занятия"
              rows={1}
              className="min-h-0 w-auto max-w-full resize-none rounded-xl border-transparent bg-transparent px-1.5 py-0.5 text-[22px] leading-snug font-black [field-sizing:content] hover:border-border focus-visible:border-ring"
            />
            <Badge variant={published ? "published" : "draft"}>{published ? "Опубликовано" : "Черновик"}</Badge>
          </div>
          <SaveIndicator status={save.status} error={save.error} />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <PdfMenu onPrint={onPrint} />
          <PublishButton lesson={lesson} publish={publish} onPublishChange={onPublishChange} canPublish={save.status === "saved"} onError={onError} activeTime={activeTime} />
        </div>
      </div>
    </header>
  );
}

function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  const view: Record<SaveStatus, { text: string; icon?: React.ReactNode; className: string }> = {
    saved: { text: "Сохранено", icon: <Check className="size-4" strokeWidth={2.6} />, className: "text-ok-dark" },
    pending: { text: "Есть несохранённые изменения…", className: "text-muted-foreground" },
    saving: { text: "Сохраняем…", icon: <Loader2 className="size-4 animate-spin" />, className: "text-muted-foreground" },
    invalid: { text: "Не сохранено: есть ошибки", icon: <AlertCircle className="size-4" />, className: "text-destructive" },
    error: { text: error ?? "Ошибка сохранения", icon: <AlertCircle className="size-4" />, className: "text-destructive" },
  };
  const { text, icon, className } = view[status];
  return (
    <span aria-live="polite" className={cn("flex items-center gap-1.5 px-1.5 text-sm font-extrabold", className)}>
      {icon}
      {text}
    </span>
  );
}

/** «PDF» с выбором версии: для студентов (без ответов) или для ментора (с ответами и критериями). */
function PdfMenu({ onPrint }: { onPrint: (variant: PrintVariant) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (variant: PrintVariant) => {
    setOpen(false);
    onPrint(variant);
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="lg"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        <Download data-icon="inline-start" />
        PDF
        <ChevronDown data-icon="inline-end" className="size-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-1 rounded-2xl border-2 border-border bg-card p-2 shadow-card"
        >
          <button role="menuitem" type="button" onClick={() => choose("student")} className="flex flex-col rounded-xl px-3 py-2.5 text-left hover:bg-muted">
            <span className="font-extrabold">Для студентов</span>
            <span className="text-sm font-semibold text-muted-foreground">Тест без ответов</span>
          </button>
          <button role="menuitem" type="button" onClick={() => choose("mentor")} className="flex flex-col rounded-xl px-3 py-2.5 text-left hover:bg-muted">
            <span className="font-extrabold">Для ментора</span>
            <span className="text-sm font-semibold text-muted-foreground">С ответами и критериями проверки</span>
          </button>
        </div>
      )}
    </div>
  );
}

function PublishButton({
  lesson,
  publish,
  onPublishChange,
  canPublish,
  onError,
  activeTime,
}: {
  lesson: EditorLesson;
  publish: PublishState;
  onPublishChange: (state: PublishState) => void;
  canPublish: boolean;
  onError: (message: string | null) => void;
  activeTime: ActiveTime;
}) {
  const [busy, setBusy] = useState(false);
  const published = publish.status === "published";

  async function toggle() {
    setBusy(true);
    onError(null);
    const activeMs = published ? 0 : activeTime.take();
    try {
      const res = await fetch(`/api/lessons/${lesson.editId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published, activeMs }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error);
      onPublishChange({
        status: data.status,
        publishedAt: data.publishedAt,
        firstPublishedAt: data.firstPublishedAt,
        prepDurationMs: data.prepDurationMs,
        activePrepMs: data.activePrepMs,
      });
    } catch (e) {
      activeTime.restore(activeMs);
      onError((e as Error).message || "Не удалось изменить статус публикации.");
    } finally {
      setBusy(false);
    }
  }

  if (published) {
    return (
      <Button variant="outline" size="lg" onClick={toggle} disabled={busy}>
        {busy && <Loader2 data-icon="inline-start" className="animate-spin" />}
        Снять с публикации
      </Button>
    );
  }
  return (
    <Button
      variant="success"
      size="lg"
      onClick={toggle}
      disabled={busy || !canPublish}
      title={canPublish ? undefined : "Опубликовать можно, когда все изменения сохранены"}
      className="px-[22px] font-black"
    >
      {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <ArrowRight data-icon="inline-start" strokeWidth={2.4} />}
      Опубликовать
    </Button>
  );
}
