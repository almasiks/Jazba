import { ShieldCheck } from "lucide-react";
import { BlockIcon, BLOCK_STYLE } from "@/components/block-style";
import { Generator } from "@/components/generator";
import { BLOCK_KEYS, BLOCK_LABELS } from "@/lib/schema";
import { isMockMode } from "@/lib/mock";

export default function Home() {
  return (
    <>
      <header className="flex flex-col gap-2.5">
        <span className="w-fit rounded-full bg-sun-soft px-3 py-1.5 text-sm font-extrabold text-sun-ink">
          Новое занятие
        </span>
        <h1 className="text-[32px] leading-tight font-black tracking-tight sm:text-[40px]">
          Из записи занятия — в готовые материалы
        </h1>
        <p className="max-w-[660px] text-lg leading-normal text-muted-foreground">
          Загрузите транскрипт из Zoom — конспект, тест, домашка, FAQ и глоссарий будут готовы за пару
          минут. Перед публикацией вы всё проверите и поправите.
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px]">
          <Generator demo={isMockMode()} />
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-3xl border-2 border-border bg-card p-6 shadow-card">
            <h2 className="text-xl font-black">Что вы получите</h2>
            {BLOCK_KEYS.map((block) => (
              <div key={block} className="flex items-center gap-3.5">
                <BlockIcon block={block} />
                <div className="flex flex-col">
                  <span className="font-black">{BLOCK_LABELS[block]}</span>
                  <span className="text-sm font-semibold text-muted-foreground">{BLOCK_STYLE[block].hint}</span>
                </div>
              </div>
            ))}
          </section>

          <section className="flex gap-3.5 rounded-3xl border-2 border-ok-line bg-ok-soft p-[22px]">
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-card text-ok-dark" aria-hidden>
              <ShieldCheck className="size-[22px]" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-black text-ok-ink">Имена студентов защищены</h2>
              <p className="text-sm leading-relaxed font-semibold text-[#22543d]">
                Замена происходит прямо в браузере. Перед отправкой видно, что именно уйдёт в ИИ.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
