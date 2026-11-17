import { FlaskConical } from "lucide-react";

/** Плашка демо-режима: материалы берутся из samples/mock-materials.json, без ИИ. */
export function DemoBadge() {
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sun-soft px-3 py-1.5 text-[13px] font-extrabold text-sun-ink"
      title="Нет ключа ИИ (AI_API_KEY) или включён MOCK_GENERATION=true — показываем готовый пример материалов"
    >
      <FlaskConical className="size-4" />
      Демо-режим: без ИИ
    </span>
  );
}
