import type { SummarySection } from "@/lib/schema";
import { EmptyState } from "./empty-state";
import { TimestampLink } from "./timestamp-link";

export function SummaryTab({ sections }: { sections: SummarySection[] }) {
  if (sections.length === 0) return <EmptyState>Конспект пуст.</EmptyState>;

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, i) => (
        <article key={i} className="flex flex-col gap-3 rounded-[22px] border-2 border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white" aria-hidden>
              {i + 1}
            </span>
            <h3 className="min-w-0 flex-1 text-lg leading-snug font-black">{section.heading}</h3>
            <TimestampLink value={section.timestamp} />
          </div>
          <ul className="flex list-disc flex-col gap-2 pl-6 leading-relaxed font-semibold marker:text-brand">
            {section.points.map((point, j) => (
              <li key={j} className="whitespace-pre-wrap">
                {point}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
