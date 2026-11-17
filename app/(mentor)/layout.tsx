import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoBadge } from "@/components/demo-badge";
import { Logo } from "@/components/logo";
import { MentorNav } from "@/components/mentor-nav";
import { Button } from "@/components/ui/button";
import { resolveAuthConfig } from "@/lib/config";
import { isMockMode } from "@/lib/mock";

// Страницы ментора не индексируем
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Оболочка страниц ментора (новое занятие, список): белая шапка с логотипом и навигацией.
 * У редактора своя шапка — он в группе (editor). Страница студента — отдельно (/s/...).
 */
export default function MentorLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b-2 border-border bg-card print:hidden">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <Link href="/" aria-label="Jazba — на главную" className="rounded-xl">
            <Logo />
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <MentorNav />
            {isMockMode() && <DemoBadge />}
            {resolveAuthConfig(process.env).mode === "password" && (
              <form method="post" action="/api/logout">
                <Button type="submit" variant="ghost" className="text-muted-foreground">
                  <LogOut data-icon="inline-start" />
                  Выйти
                </Button>
              </form>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-7 px-6 pt-10 pb-16 print:p-0">
        {children}
      </main>
    </>
  );
}
