import type { Metadata } from "next";
import { PublicDemoBanner } from "@/components/public-demo-banner";
import { resolveAuthConfig } from "@/lib/config";

// Редактор ментора не индексируем
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Оболочка редактора: своя шапка (назад, статус, PDF, публикация) рисуется в самом редакторе. */
export default function EditorLayout({ children }: LayoutProps<"/">) {
  const auth = resolveAuthConfig(process.env);
  return (
    <div className="flex flex-1 flex-col">
      {auth.mode === "open" && auth.publicDemo && <PublicDemoBanner />}
      {children}
    </div>
  );
}
