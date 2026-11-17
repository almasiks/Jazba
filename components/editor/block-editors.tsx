"use client";

import { moveItem, removeAt, replaceAt } from "@/lib/list";
import { looksLikeCode } from "@/lib/looks-like-code";
import type { FaqItem, GlossaryItem, Homework, QuizQuestion, SummarySection } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { AddButton, Field, ItemCard, StringListEditor, TextField, TimestampInput } from "./fields";

/** Общая логика для блока-списка: правка, порядок, удаление, добавление. */
function useListHandlers<T>(items: T[], onChange: (items: T[]) => void) {
  return {
    update: (i: number, patch: Partial<T>) => onChange(replaceAt(items, i, { ...items[i], ...patch })),
    move: (i: number, offset: number) => onChange(moveItem(items, i, offset)),
    remove: (i: number) => onChange(removeAt(items, i)),
    add: (item: T) => onChange([...items, item]),
  };
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[22px] border-2 border-dashed border-border bg-card p-8 text-center font-semibold text-muted-foreground">
      {children}
    </p>
  );
}

const LETTERS = ["A", "B", "C", "D"];

// ---------- Конспект ----------

export function SummaryEditor({ value, onChange }: { value: SummarySection[]; onChange: (v: SummarySection[]) => void }) {
  const h = useListHandlers(value, onChange);
  return (
    <div className="flex flex-col gap-[18px]">
      {value.length === 0 && <EmptyHint>В конспекте нет разделов.</EmptyHint>}
      {value.map((section, i) => (
        <ItemCard
          key={i}
          block="summary"
          title={`Раздел ${i + 1}`}
          extra={<TimestampInput value={section.timestamp} onChange={(timestamp) => h.update(i, { timestamp })} label={`Раздел ${i + 1}: таймкод`} />}
          index={i}
          count={value.length}
          onMove={(o) => h.move(i, o)}
          onRemove={() => h.remove(i)}
        >
          <Field label="Заголовок">
            <TextField value={section.heading} onChange={(heading) => h.update(i, { heading })} className="text-[17px] font-extrabold" />
          </Field>
          <Field label="Тезисы">
            <StringListEditor items={section.points} onChange={(points) => h.update(i, { points })} itemLabel="Тезис" addLabel="Добавить тезис" />
          </Field>
        </ItemCard>
      ))}
      <AddButton big onClick={() => h.add({ heading: "", points: [""] })}>
        Добавить раздел
      </AddButton>
    </div>
  );
}

// ---------- Тест ----------

export function QuizEditor({ value, onChange }: { value: QuizQuestion[]; onChange: (v: QuizQuestion[]) => void }) {
  const h = useListHandlers(value, onChange);
  return (
    <div className="flex flex-col gap-[18px]">
      {value.length === 0 && <EmptyHint>В тесте нет вопросов.</EmptyHint>}
      {value.map((q, i) => (
        <ItemCard
          key={i}
          block="quiz"
          title={`Вопрос ${i + 1}`}
          extra={<TimestampInput value={q.timestamp} onChange={(timestamp) => h.update(i, { timestamp })} label={`Вопрос ${i + 1}: где объяснялось`} />}
          index={i}
          count={value.length}
          onMove={(o) => h.move(i, o)}
          onRemove={() => h.remove(i)}
        >
          <Field label="Вопрос">
            <TextField value={q.question} onChange={(question) => h.update(i, { question })} className="text-[17px] font-extrabold" />
          </Field>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-sm font-extrabold text-muted-foreground">Варианты — отметьте верный</legend>
            {q.options.map((option, j) => {
              const correct = j === q.correctIndex;
              return (
                <div
                  key={j}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] border-2 border-border px-3 py-1.5 transition-colors",
                    correct && "border-ok bg-ok-soft",
                  )}
                >
                  <input
                    type="radio"
                    name={`quiz-${i}-correct`}
                    checked={correct}
                    onChange={() => h.update(i, { correctIndex: j })}
                    aria-label={`Вариант ${LETTERS[j]} — верный`}
                    className="size-[22px] shrink-0 accent-ok"
                  />
                  <span className="font-black text-muted-foreground">{LETTERS[j]}</span>
                  <TextField
                    value={option}
                    onChange={(text) => h.update(i, { options: replaceAt(q.options, j, text) })}
                    aria-label={`Вариант ${LETTERS[j]}`}
                    className={cn(
                      "min-h-9 flex-1 border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:ring-0",
                      looksLikeCode(option) && "font-mono text-[15px]",
                    )}
                  />
                  {correct && <span className="text-[13px] font-black text-ok-ink">Верный</span>}
                </div>
              );
            })}
          </fieldset>

          <Field label="Объяснение (студент увидит после ответа)">
            <TextField value={q.explanation} onChange={(explanation) => h.update(i, { explanation })} className="font-semibold" />
          </Field>
        </ItemCard>
      ))}
      <AddButton big onClick={() => h.add({ question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" })}>
        Добавить вопрос
      </AddButton>
    </div>
  );
}

// ---------- Домашка ----------

export function HomeworkEditor({ value, onChange }: { value: Homework; onChange: (v: Homework) => void }) {
  return (
    <article className="flex flex-col gap-5 rounded-[22px] border-2 border-border bg-card p-[22px] shadow-card">
      <Field label="Задание">
        <TextField value={value.task} onChange={(task) => onChange({ ...value, task })} className="min-h-24 font-semibold" />
      </Field>
      <Field label="Требования (видят студенты)">
        <StringListEditor
          items={value.requirements}
          onChange={(requirements) => onChange({ ...value, requirements })}
          itemLabel="Требование"
          addLabel="Добавить требование"
          ordered
        />
      </Field>
      <Field label="Критерии проверки (только для вас и PDF ментора)">
        <StringListEditor
          items={value.criteria}
          onChange={(criteria) => onChange({ ...value, criteria })}
          itemLabel="Критерий"
          addLabel="Добавить критерий"
        />
      </Field>
    </article>
  );
}

// ---------- FAQ ----------

export function FaqEditor({ value, onChange }: { value: FaqItem[]; onChange: (v: FaqItem[]) => void }) {
  const h = useListHandlers(value, onChange);
  return (
    <div className="flex flex-col gap-[18px]">
      {value.length === 0 && <EmptyHint>Студенты не задавали вопросов — FAQ пуст. Можно добавить вручную.</EmptyHint>}
      {value.map((item, i) => (
        <ItemCard
          key={i}
          block="faq"
          title={`Вопрос ${i + 1}`}
          extra={<TimestampInput value={item.timestamp} onChange={(timestamp) => h.update(i, { timestamp })} label={`Вопрос ${i + 1}: где прозвучал`} />}
          index={i}
          count={value.length}
          onMove={(o) => h.move(i, o)}
          onRemove={() => h.remove(i)}
        >
          <Field label="Вопрос студента">
            <TextField value={item.question} onChange={(question) => h.update(i, { question })} className="text-[17px] font-extrabold" />
          </Field>
          <Field label="Ответ ментора">
            <TextField value={item.answer} onChange={(answer) => h.update(i, { answer })} className="font-semibold" />
          </Field>
        </ItemCard>
      ))}
      <AddButton big onClick={() => h.add({ question: "", answer: "" })}>
        Добавить вопрос
      </AddButton>
    </div>
  );
}

// ---------- Глоссарий ----------

export function GlossaryEditor({ value, onChange }: { value: GlossaryItem[]; onChange: (v: GlossaryItem[]) => void }) {
  const h = useListHandlers(value, onChange);
  return (
    <div className="flex flex-col gap-[18px]">
      {value.length === 0 && <EmptyHint>Глоссарий пуст.</EmptyHint>}
      {value.map((item, i) => (
        <ItemCard
          key={i}
          block="glossary"
          title={item.term.trim() || `Термин ${i + 1}`}
          index={i}
          count={value.length}
          onMove={(o) => h.move(i, o)}
          onRemove={() => h.remove(i)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Термин (как на занятии)">
              <TextField value={item.term} onChange={(term) => h.update(i, { term })} className="font-extrabold" />
            </Field>
            <Field label="Қазақша">
              <TextField value={item.kk} onChange={(kk) => h.update(i, { kk })} optional />
            </Field>
            <Field label="Русский">
              <TextField value={item.ru} onChange={(ru) => h.update(i, { ru })} optional />
            </Field>
            <Field label="English">
              <TextField value={item.en} onChange={(en) => h.update(i, { en })} optional />
            </Field>
          </div>
          <Field label="Определение">
            <TextField value={item.definition} onChange={(definition) => h.update(i, { definition })} className="font-semibold" />
          </Field>
        </ItemCard>
      ))}
      <AddButton big onClick={() => h.add({ term: "", kk: "", ru: "", en: "", definition: "" })}>
        Добавить термин
      </AddButton>
    </div>
  );
}
