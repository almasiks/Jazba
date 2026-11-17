/**
 * Вход ментора по паролю: подписанная cookie сессии.
 *
 * Токен: "<срок действия в мс>.<HMAC-SHA256(secret, срок) в base64url>".
 * Подделать без секрета нельзя; смена пароля (секрета) делает старые cookie недействительными.
 * Только Web Crypto — работает и в proxy.ts, и в route handlers, и в тестах Node.
 */

export const SESSION_COOKIE = "jazba_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Сравнение строк за время, не зависящее от места первого расхождения. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expires = String(now + SESSION_TTL_MS);
  return `${expires}.${await hmac(secret, expires)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const [expires, signature, extra] = token.split(".");
  if (!expires || !signature || extra !== undefined || !/^\d+$/.test(expires)) return false;
  if (Number(expires) <= now) return false;
  return safeEqual(signature, await hmac(secret, expires));
}

/**
 * Проверка пароля. Сравниваем HMAC обеих строк — так длина и содержимое
 * пароля не «утекают» через время ответа.
 */
export async function checkPassword(input: string, password: string): Promise<boolean> {
  const key = "jazba-password-check";
  return safeEqual(await hmac(key, input), await hmac(key, password));
}

/** Достаёт значение cookie из заголовка Cookie. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Куда вернуть после входа: только относительный путь внутри сайта. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/lessons";
  return value;
}
