"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/lessons", label: "Мои занятия" },
  { href: "/", label: "Новое занятие" },
];

/** Пункты шапки ментора; активный подсвечен, как в дизайне. */
export function MentorNav() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-xl px-4 font-extrabold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
