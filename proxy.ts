import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/lib/access-rules";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { resolveAuthConfig } from "@/lib/config";

/**
 * Проверка до рендеринга страницы (правила — в lib/access-rules.ts):
 *  - вход ментора по cookie для страниц и API ментора;
 *  - настоящий 404 для ID неверного формата (страницы стримятся и иначе начинаются с 200).
 * Страница студента /s/<slug> открыта. API дополнительно проверяют доступ сами.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function proxy(request: NextRequest) {
  const auth = resolveAuthConfig(process.env);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = auth.mode === "password" && (await verifySessionToken(token, auth.secret));
  const decision = decideAccess(request.nextUrl.pathname, auth.mode, hasSession);

  switch (decision.action) {
    case "allow":
      return NextResponse.next();
    case "login": {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", decision.next);
      return NextResponse.redirect(url);
    }
    case "unauthorized":
      return Response.json({ ok: false, error: "Нужно войти как ментор." }, { status: 401 });
    case "misconfigured":
      return Response.json(
        { ok: false, error: "Сервер не настроен: задайте MENTOR_PASSWORD в переменных окружения." },
        { status: 503 },
      );
    case "not-found":
      return new Response(NOT_FOUND_HTML, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
  }
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Страница не найдена — Jazba</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center;color:#171717;background:#fff}
@media (prefers-color-scheme:dark){body{color:#ededed;background:#0a0a0a}}p{color:#737373}a{color:inherit}</style></head>
<body><main><h1>Страница не найдена</h1><p>Проверьте ссылку — возможно, в ней опечатка.</p><p><a href="/">На главную</a></p></main></body></html>`;
