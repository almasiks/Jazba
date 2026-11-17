import type { Homework } from "@/lib/schema";

/** Домашка. Критерии проверки показываем только ментору (showCriteria). */
export function HomeworkTab({ homework, showCriteria = false }: { homework: Homework; showCriteria?: boolean }) {
  return (
    <article className="flex flex-col gap-5 rounded-[22px] border-2 border-border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-[#ddf6f4] px-3 py-1 text-sm font-black text-[#0e8580]">Задание</span>
        <p className="leading-relaxed font-semibold whitespace-pre-wrap">{homework.task}</p>
      </div>
      <List title="Требования" items={homework.requirements} ordered />
      {showCriteria && <List title="Критерии проверки" items={homework.criteria} />}
    </article>
  );
}

function List({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-black">{title}</h3>
      <Tag className={`flex flex-col gap-2 pl-6 leading-relaxed font-semibold marker:font-black marker:text-[#0e8580] ${ordered ? "list-decimal" : "list-disc"}`}>
        {items.map((item, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {item}
          </li>
        ))}
      </Tag>
    </div>
  );
}
