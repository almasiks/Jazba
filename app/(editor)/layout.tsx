import type { Metadata } from "next";

// Редактор ментора не индексируем
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Оболочка редактора: своя шапка (назад, статус, PDF, публикация) рисуется в самом редакторе. */
export default function EditorLayout({ children }: LayoutProps<"/">) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
