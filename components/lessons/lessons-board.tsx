"use client";

import { BookOpenText, CircleCheck, Clock3, Code, Info, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDuration, lessonStats, prepTimeMs } from "@/lib/lessons";
import type { Lesson } from "@/lib/schema";
import { cn } from "@/lib/utils";

/** Строка списка — только то, что нужно странице (без материалов и транскрипта). */
export type LessonRow = Pick<
  Lesson,
  "editId" | "createdAt" | "status" | "mock" | "firstPublishedAt" | "activePrepMs" | "prepDurationMs"
> & { title: string; recordingLength: string | null };

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Almaty" });

// Цвета иконок в строках списка — по кругу, как в дизайне
const ROW_COLORS = [
  "bg-[#fff4cc] text-[#9a6b00]",
  "bg-brand-soft text-brand",
  "bg-[#ddf6f4] text-[#0e8580]",
  "bg-[#fde7ef] text-[#c42a62]",
  "bg-[#ffeedf] text-[#d9620f]",
];

const PREP_HINT = "Активное время от загрузки транскрипта до публикации";

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Что подтверждаем: одно занятие, выбранные или все демо. */
type Pending =
  | { kind: "one"; ids: string[]; title: string }
  | { kind: "selected"; ids: string[] }
  | { kind: "demo"; ids: string[] };

export function LessonsBoard({ initialLessons }: { initialLessons: LessonRow[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [showDemo, setShowDemo] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const demoIds = useMemo(() => lessons.filter((l) => l.mock).map((l) => l.editId), [lessons]);
  const visible = useMemo(() => (showDemo ? lessons : lessons.filter((l) => !l.mock)), [lessons, showDemo]);
  // Выбранными считаем только видимые строки: скрытые демо случайно не удалятся
  const selectedVisible = visible.filter((l) => selected.has(l.editId)).map((l) => l.editId);
  const allSelected = visible.length > 0 && selectedVisible.length === visible.length;
  const stats = lessonStats(lessons);

  // Уведомление само исчезает через 3 секунды
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function toggle(editId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(editId)) next.delete(editId);
      else next.add(editId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map((l) => l.editId)));
  }

  async function confirmDelete() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const single = pending.ids.length === 1;
      const res = await fetch(single ? `/api/lessons/${pending.ids[0]}` : "/api/lessons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: single ? undefined : JSON.stringify({ editIds: pending.ids }),
      });
      const data = await res.json().catch(() => null);
      // 404 при одиночном удалении — занятия уже нет, строку тоже убираем
      if (!res.ok && !(single && res.status === 404)) {
        throw new Error(data?.error || `Не удалось удалить (код ${res.status}).`);
      }
      const gone = new Set<string>(single ? pending.ids : (data?.deleted ?? []));
      setLessons((list) => list.filter((l) => !gone.has(l.editId)));
      setSelected((current) => new Set([...current].filter((id) => !gone.has(id))));
      setToast(
        gone.size === 1 ? "Занятие удалено" : `Удалено ${gone.size} ${plural(gone.size, "занятие", "занятия", "занятий")}`,
      );
      setPending(null);
    } catch (e) {
      setError((e as Error).message || "Нет связи с сервером.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <Stat
          icon={<BookOpenText className="size-[26px]" strokeWidth={2.2} />}
          iconClass="bg-brand-soft text-brand"
          value={String(stats.count)}
          label={plural(stats.count, "занятие подготовлено", "занятия подготовлено", "занятий подготовлено")}
        />
        <Stat
          icon={<Clock3 className="size-[26px]" strokeWidth={2.2} />}
          iconClass="bg-card text-foreground"
          value={stats.averagePrepMs !== null ? formatDuration(stats.averagePrepMs) : "—"}
          label="в среднем на подготовку"
          hint={PREP_HINT}
          sunny
        />
        <Stat
          icon={<CircleCheck className="size-[26px]" strokeWidth={2.2} />}
          iconClass="bg-ok-soft text-ok-dark"
          value={`${stats.published} из ${stats.count}`}
          label="опубликовано студентам"
        />
      </div>
      {demoIds.length > 0 && (
        <p className="-mt-2 text-sm font-semibold text-muted-foreground">
          Демо-занятия (созданы без ИИ) в статистике не учитываются.
        </p>
      )}

      {lessons.length === 0 ? (
        <EmptyLessons />
      ) : (
        <section className="overflow-hidden rounded-3xl border-2 border-border bg-card shadow-card" aria-label="Список занятий">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-track bg-surface-soft px-[22px] py-2.5">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 font-extrabold">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedVisible.length > 0 && !allSelected}
                onChange={toggleAll}
                disabled={visible.length === 0}
              />
              Выбрать все
            </label>
            {selectedVisible.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setPending({ kind: "selected", ids: selectedVisible })}
              >
                <Trash2 data-icon="inline-start" />
                Удалить выбранные ({selectedVisible.length})
              </Button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {demoIds.length > 0 && (
                <>
                  <DemoSwitch checked={showDemo} onChange={setShowDemo} count={demoIds.length} />
                  <Button variant="outline" size="sm" onClick={() => setPending({ kind: "demo", ids: demoIds })}>
                    Удалить все демо
                  </Button>
                </>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="px-[22px] py-8 text-center font-semibold text-muted-foreground">
              Здесь только демо-занятия — включите «Показывать демо», чтобы их увидеть.
            </p>
          ) : (
            <ul>
              {visible.map((lesson, i) => (
                <LessonItem
                  key={lesson.editId}
                  lesson={lesson}
                  color={ROW_COLORS[i % ROW_COLORS.length]}
                  checked={selected.has(lesson.editId)}
                  onToggle={() => toggle(lesson.editId)}
                  onDelete={() => setPending({ kind: "one", ids: [lesson.editId], title: lesson.title })}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPending(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          {pending && <ConfirmText pending={pending} />}
          {error && (
            <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-bold text-bad-ink">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="lg" disabled={busy} />}>Отмена</AlertDialogClose>
            <Button variant="destructive" size="lg" onClick={confirmDelete} disabled={busy}>
              {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <span className="rounded-2xl bg-foreground px-5 py-3 font-extrabold text-background shadow-lg">
            {toast}
          </span>
        )}
      </div>
    </>
  );
}

function ConfirmText({ pending }: { pending: Pending }) {
  const n = pending.ids.length;
  const title =
    pending.kind === "one"
      ? `Удалить «${pending.title}»?`
      : pending.kind === "demo"
        ? `Удалить все демо-занятия (${n})?`
        : `Удалить ${n} ${plural(n, "занятие", "занятия", "занятий")}?`;
  const link =
    n === 1 ? "Ссылка для студентов перестанет работать." : "Ссылки для студентов перестанут работать.";
  return (
    <>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>{link} Это нельзя отменить.</AlertDialogDescription>
    </>
  );
}

function LessonItem({
  lesson,
  color,
  checked,
  onToggle,
  onDelete,
}: {
  lesson: LessonRow;
  color: string;
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isPublished = lesson.status === "published";
  const prep = prepTimeMs(lesson);
  return (
    <li className="flex flex-wrap items-center gap-4 border-b-2 border-track px-[22px] py-[18px] last:border-b-0">
      <label className="-m-2 grid size-11 shrink-0 cursor-pointer place-items-center">
        <Checkbox checked={checked} onChange={onToggle} aria-label={`Выбрать «${lesson.title}»`} />
      </label>
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-[14px]", color)} aria-hidden>
        <Code className="size-6" strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-lg font-black">
          {lesson.title}
          {lesson.mock && (
            <Badge variant="draft" className="px-2.5 py-0.5" title="Создано в демо-режиме, без ИИ">
              Демо
            </Badge>
          )}
        </span>
        <span className="text-[15px] font-semibold text-muted-foreground">
          {dateFormat.format(new Date(lesson.createdAt))}
          {lesson.recordingLength && ` · запись ${lesson.recordingLength}`}
        </span>
      </div>
      {prep !== null && (
        <span
          className="flex items-center gap-1.5 text-[15px] font-extrabold text-muted-foreground"
          title={lesson.activePrepMs !== null ? PREP_HINT : "Время от загрузки транскрипта до публикации"}
        >
          <Clock3 className="size-[18px]" strokeWidth={2.2} aria-hidden />
          {formatDuration(prep)}
        </span>
      )}
      <Badge variant={isPublished ? "published" : "draft"} className="min-w-[104px] px-3 py-1.5 text-sm">
        {isPublished ? "Опубликовано" : "Черновик"}
      </Badge>
      <div className="flex items-center gap-2">
        <Link href={`/lessons/${lesson.editId}`} className={buttonVariants({ variant: "outline" })}>
          Открыть
        </Link>
        <Button variant="outline" size="icon" aria-label="Удалить занятие" title="Удалить занятие" onClick={onDelete}>
          <Trash2 className="text-bad-ink" />
        </Button>
      </div>
    </li>
  );
}

/** Нативный чекбокс в цветах Jazba; indeterminate ставится через DOM. */
function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  disabled,
  ...props
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="size-5 cursor-pointer accent-brand disabled:cursor-not-allowed"
      {...props}
    />
  );
}

/** Переключатель «Показывать демо». */
function DemoSwitch({ checked, onChange, count }: { checked: boolean; onChange: (value: boolean) => void; count: number }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-2.5 rounded-xl px-1 font-extrabold"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full border-2 transition-colors",
          checked ? "border-brand bg-brand" : "border-border bg-track",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      Показывать демо ({count})
    </button>
  );
}

function EmptyLessons() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-brand-line bg-surface-soft p-12 text-center">
      <span className="text-lg font-black">Занятий пока нет</span>
      <Link href="/" className={buttonVariants()}>
        <Plus data-icon="inline-start" />
        Создать первое
      </Link>
    </div>
  );
}

function Stat({
  icon,
  iconClass,
  value,
  label,
  hint,
  sunny,
}: {
  icon: React.ReactNode;
  iconClass: string;
  value: string;
  label: string;
  hint?: string;
  sunny?: boolean;
}) {
  return (
    <div
      title={hint}
      className={cn(
        "flex items-center gap-4 rounded-[22px] border-2 px-[22px] py-5",
        sunny ? "border-[#e8b020] bg-sun shadow-[0_5px_0_var(--color-sun-dark)]" : "border-border bg-card shadow-card",
      )}
    >
      <span className={cn("grid size-[52px] shrink-0 place-items-center rounded-2xl", iconClass)} aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[30px] leading-tight font-black">{value}</span>
        <span className={cn("flex items-center gap-1.5 font-bold", sunny ? "text-[#3d2c00]" : "text-muted-foreground")}>
          {label}
          {hint && (
            <span className="inline-flex" role="img" aria-label={hint}>
              <Info className="size-4" strokeWidth={2.4} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
