/**
 * Ссылка на запись занятия и переходы по таймкодам.
 */
import { parseTimecode } from "./timecode.ts";

/** Ссылка корректная, если это http(s)-адрес. */
export function isValidRecordingUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** ID видео YouTube из ссылки (watch, youtu.be, live, shorts, embed) или null. */
export function getYouTubeId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const isId = (id: string | null | undefined): id is string =>
    !!id && /^[\w-]{11}$/.test(id);

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return isId(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (isId(v)) return v;
    const [, kind, id] = url.pathname.split("/");
    if (["live", "shorts", "embed", "v"].includes(kind) && isId(id)) return id;
  }
  return null;
}

export type TimecodeLink = {
  href: string;
  /** true — ссылка сразу открывает нужную секунду (YouTube). */
  seeks: boolean;
};

/** Куда ведёт таймкод: YouTube — на нужную секунду, иначе — просто на запись. */
export function buildTimecodeLink(recordingUrl: string, timecode: string): TimecodeLink | null {
  if (!isValidRecordingUrl(recordingUrl)) return null;
  const seconds = parseTimecode(timecode);
  const id = getYouTubeId(recordingUrl);
  if (id && seconds !== null) {
    return { href: `https://www.youtube.com/watch?v=${id}&t=${seconds}s`, seeks: true };
  }
  return { href: recordingUrl.trim(), seeks: false };
}
