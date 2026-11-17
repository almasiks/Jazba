import { BookOpenText, CircleCheck, Code, Globe, MessageSquare, type LucideIcon } from "lucide-react";
import type { BlockKey } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * Цветовая кодировка блоков материалов из дизайна:
 * конспект — фиолетовый, тест — оранжевый, домашка — бирюзовый, FAQ — розовый, глоссарий — жёлтый.
 */
export const BLOCK_STYLE: Record<
  BlockKey,
  {
    icon: LucideIcon;
    /** Мягкая плашка иконки: фон + цвет иконки */
    soft: string;
    /** Залитая «таблетка» активной вкладки / номера элемента */
    solid: string;
    /** Подсветка активного пункта в боковом меню редактора */
    active: string;
    hint: string;
  }
> = {
  summary: {
    icon: BookOpenText,
    soft: "bg-brand-soft text-brand",
    solid: "bg-brand text-white border-brand",
    active: "border-brand-line bg-brand-soft",
    hint: "Разделы с таймкодами записи",
  },
  quiz: {
    icon: CircleCheck,
    soft: "bg-[#ffeedf] text-[#d9620f]",
    solid: "bg-quiz text-foreground border-quiz",
    active: "border-quiz-line bg-quiz-soft",
    hint: "5–10 вопросов на понимание",
  },
  homework: {
    icon: Code,
    soft: "bg-[#ddf6f4] text-[#0e8580]",
    solid: "bg-[#0e8580] text-white border-[#0e8580]",
    active: "border-[#a6e3de] bg-[#eefaf9]",
    hint: "Практика с критериями проверки",
  },
  faq: {
    icon: MessageSquare,
    soft: "bg-[#fde7ef] text-[#c42a62]",
    solid: "bg-[#c42a62] text-white border-[#c42a62]",
    active: "border-[#f5bcd0] bg-[#fef3f7]",
    hint: "Вопросы студентов с занятия",
  },
  glossary: {
    icon: Globe,
    soft: "bg-[#fff4cc] text-[#9a6b00]",
    solid: "bg-sun text-foreground border-sun",
    active: "border-[#f5dc8a] bg-[#fffbeb]",
    hint: "Термины: қаз · рус · eng",
  },
};

/** Квадратная плашка с иконкой блока. */
export function BlockIcon({ block, size = "md", className }: { block: BlockKey; size?: "sm" | "md" | "lg"; className?: string }) {
  const { icon: Icon, soft } = BLOCK_STYLE[block];
  const box = { sm: "size-[34px] rounded-[10px]", md: "size-11 rounded-[14px]", lg: "size-12 rounded-[14px]" }[size];
  const icon = { sm: "size-[18px]", md: "size-[22px]", lg: "size-6" }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center", box, soft, className)} aria-hidden>
      <Icon className={icon} strokeWidth={2.2} />
    </span>
  );
}
