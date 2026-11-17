"use client";

import { createContext, useContext } from "react";

/** Ссылка на запись занятия — доступна всем таймкодам в материалах. */
const RecordingContext = createContext<string | null>(null);

export const RecordingProvider = RecordingContext.Provider;

export function useRecordingUrl(): string | null {
  return useContext(RecordingContext);
}
