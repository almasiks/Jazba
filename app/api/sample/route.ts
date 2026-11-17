import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireMentorApi } from "@/lib/server/guard";

/** Примеры из samples/ — чтобы можно было сразу проверить генерацию. */
const SAMPLES: Record<string, string> = {
  text: "js-async-lesson.txt",
  vtt: "js-arrays-lesson.vtt",
};

export async function GET(request: Request) {
  const denied = await requireMentorApi(request);
  if (denied) return denied;

  const kind = new URL(request.url).searchParams.get("kind") ?? "text";
  const fileName = SAMPLES[kind];
  if (!fileName) return new Response("Неизвестный пример", { status: 404 });

  try {
    const text = await readFile(path.join(process.cwd(), "samples", fileName), "utf8");
    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Sample-File": encodeURIComponent(fileName),
      },
    });
  } catch {
    return new Response("Пример не найден", { status: 404 });
  }
}
