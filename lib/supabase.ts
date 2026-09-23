import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Browser Supabase client. The site is fully static; all access rules are enforced by Supabase RLS. */
export function supabase() {
  if (!isConfigured) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  client ??= createClient(url!, key!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
