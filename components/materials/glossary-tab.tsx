import type { GlossaryItem } from "@/lib/schema";
import { EmptyState } from "./empty-state";

/** Глоссарий карточками — удобно читать с телефона. */
export function GlossaryTab({ items }: { items: GlossaryItem[] }) {
  if (items.length === 0) return <EmptyState>Глоссарий пуст.</EmptyState>;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <article key={i} className="flex flex-col gap-2.5 rounded-[22px] border-2 border-border bg-card p-4 shadow-card">
          <h3 className="text-lg font-black">{item.term}</h3>
          <dl className="flex flex-wrap gap-2 text-sm">
            {(
              [
                ["қаз", item.kk],
                ["рус", item.ru],
                ["eng", item.en],
              ] as const
            )
              .filter(([, value]) => value.trim())
              .map(([lang, value]) => (
                <div key={lang} className="flex items-center gap-1.5 rounded-full bg-[#fff4cc] px-3 py-1">
                  <dt className="font-black text-[#9a6b00] uppercase">{lang}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
          </dl>
          <p className="leading-relaxed font-semibold text-muted-foreground">{item.definition}</p>
        </article>
      ))}
    </div>
  );
}
