import type { FaqItem } from "@/lib/schema";
import { EmptyState } from "./empty-state";
import { TimestampLink } from "./timestamp-link";

export function FaqTab({ items }: { items: FaqItem[] }) {
  if (items.length === 0) {
    return <EmptyState>На занятии студенты не задавали вопросов — FAQ пуст.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <article key={i} className="flex flex-col gap-2.5 rounded-[22px] border-2 border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start gap-2.5">
            <h3 className="min-w-0 flex-1 text-lg leading-snug font-black">{item.question}</h3>
            <TimestampLink value={item.timestamp} />
          </div>
          <p className="leading-relaxed font-semibold text-muted-foreground whitespace-pre-wrap">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}
