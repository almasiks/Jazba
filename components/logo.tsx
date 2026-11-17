import { NotebookPen } from "lucide-react";

/** Логотип Jazba: плашка с иконкой и «Jaz» + «ba» основным фиолетовым цветом. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid size-10 place-items-center rounded-xl bg-brand text-white shadow-[0_4px_0_var(--color-brand-dark)]"
        aria-hidden
      >
        <NotebookPen className="size-[22px]" strokeWidth={2.2} />
      </span>
      <span className="text-2xl font-black tracking-tight">
        Jaz<span className="text-brand">ba</span>
      </span>
    </span>
  );
}
