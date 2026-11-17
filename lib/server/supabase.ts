import "server-only"; // ключ service role не должен попасть в браузерный бандл

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseConfig } from "../config.ts";

let client: SupabaseClient | null = null;

/** Серверный клиент Supabase с ключом service role (обходит RLS). */
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const { url, serviceRoleKey } = resolveSupabaseConfig(process.env);
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
