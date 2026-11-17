import { Info } from "lucide-react";

/**
 * Плашка открытого демо-стенда (PUBLIC_DEMO=true): вход без пароля для проверяющих,
 * все занятия видны всем — поэтому просим не загружать реальные данные.
 */
export function PublicDemoBanner() {
  return (
    <div role="note" className="border-b-2 border-border bg-brand-soft print:hidden">
      <p className="mx-auto flex w-full max-w-[1200px] items-start gap-2 px-6 py-2.5 text-sm font-bold text-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <span>
          Открытый демо-стенд для проверки: вход без пароля, занятия видны всем проверяющим. Используйте пример
          .vtt и не загружайте реальные данные студентов.
        </span>
      </p>
    </div>
  );
}
