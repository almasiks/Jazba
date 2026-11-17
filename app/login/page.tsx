import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/auth";
import { resolveAuthConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Вход для ментора — Jazba",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  password: "Неверный пароль.",
  rate: "Слишком много попыток входа. Подождите 15 минут.",
  config: "Вход не настроен: администратор должен задать MENTOR_PASSWORD в переменных окружения.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <h1 className="text-[28px] font-black tracking-tight">Вход для ментора</h1>
        <p className="font-semibold text-muted-foreground">
          Студентам вход не нужен — материалы открываются по ссылке от ментора.
        </p>
      </div>
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNextPath(first(params.next));
  const misconfigured = resolveAuthConfig(process.env).mode === "misconfigured";
  const error = misconfigured ? ERRORS.config : ERRORS[first(params.error) ?? ""];

  return (
    <form method="post" action="/api/login" className="flex flex-col gap-4 rounded-3xl border-2 border-border bg-card p-6 shadow-card">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-[15px] font-extrabold">Пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          disabled={misconfigured}
          />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="xl" className="w-full" disabled={misconfigured}>
        Войти
      </Button>
    </form>
  );
}
