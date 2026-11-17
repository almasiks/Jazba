"use client";

import { ArrowDown, ArrowUp, Play, Plus, Trash2 } from "lucide-react";
import { BLOCK_STYLE } from "@/components/block-style";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { moveItem, removeAt, replaceAt } from "@/lib/list";
import type { BlockKey } from "@/lib/schema";
import { parseTimecode } from "@/lib/timecode";
import { cn } from "@/lib/utils";

/** Кнопки элемента списка: вверх, вниз, удалить. */
export function ItemControls({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (offset: number) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`${label}: выше`} className="text-muted-foreground">
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`${label}: ниже`} className="text-muted-foreground">
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`${label}: удалить`} className="text-muted-foreground hover:bg-bad-soft hover:text-bad-ink">
        <Trash2 />
      </Button>
    </div>
  );
}

/** «+ Добавить …»: большая пунктирная кнопка под списком карточек или маленькая под списком строк. */
export function AddButton({ onClick, children, big }: { onClick: () => void; children: React.ReactNode; big?: boolean }) {
  if (big) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-14 items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-brand-line bg-surface-soft text-[17px] font-black text-brand transition-colors hover:bg-brand-soft"
      >
        <Plus className="size-5" strokeWidth={2.6} aria-hidden />
        {children}
      </button>
    );
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="w-fit text-brand">
      <Plus data-icon="inline-start" strokeWidth={2.6} />
      {children}
    </Button>
  );
}

/** Подпись + поле. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-extrabold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Многострочное поле, растущее по содержимому. */
export function TextField({
  value,
  onChange,
  placeholder,
  className,
  optional,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  optional?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={(!optional && value.trim() === "") || undefined}
      rows={1}
      className={cn("min-h-12 resize-none py-2.5 [field-sizing:content]", className)}
    />
  );
}

/** Таймкод «мм:сс» (необязательный) — «таблетка» с иконкой воспроизведения, как в дизайне. */
export function TimestampInput({
  value,
  onChange,
  label = "Таймкод",
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  label?: string;
}) {
  const invalid = !!value && parseTimecode(value) === null;
  return (
    <span
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full bg-brand-soft pr-1 pl-2.5 text-brand-dark focus-within:ring-3 focus-within:ring-ring/25",
        invalid && "bg-bad-soft text-bad-ink",
      )}
    >
      <Play className="size-3.5 fill-current" aria-hidden />
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder="мм:сс"
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="w-[68px] bg-transparent font-mono text-sm font-bold tabular-nums outline-none placeholder:text-brand-dark/50"
      />
    </span>
  );
}

/** Список строк (тезисы, требования, критерии): правка, добавление, порядок, удаление. */
export function StringListEditor({
  items,
  onChange,
  itemLabel,
  addLabel,
  ordered,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  itemLabel: string;
  addLabel: string;
  ordered?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="w-6 shrink-0 pt-3 text-right text-sm font-black text-muted-foreground tabular-nums">
            {ordered ? `${i + 1}.` : "•"}
          </span>
          <TextField
            value={item}
            onChange={(value) => onChange(replaceAt(items, i, value))}
            aria-label={`${itemLabel} ${i + 1}`}
            className="flex-1"
          />
          <ItemControls
            index={i}
            count={items.length}
            label={`${itemLabel} ${i + 1}`}
            onMove={(offset) => onChange(moveItem(items, i, offset))}
            onRemove={() => onChange(removeAt(items, i))}
          />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, ""])}>{addLabel}</AddButton>
    </div>
  );
}

/** Карточка элемента: цветная «таблетка» с номером, доп. элементы (таймкод), кнопки управления. */
export function ItemCard({
  block,
  title,
  extra,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  block: BlockKey;
  title: string;
  extra?: React.ReactNode;
  index: number;
  count: number;
  onMove: (offset: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-[22px] border-2 border-border bg-card p-[22px] shadow-card">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={cn("rounded-full px-3 py-1 text-sm font-black", BLOCK_STYLE[block].solid)}>{title}</span>
        {extra}
        <span className="flex-1" />
        <ItemControls index={index} count={count} label={title} onMove={onMove} onRemove={onRemove} />
      </div>
      {children}
    </article>
  );
}
