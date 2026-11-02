import "server-only"; // build fails if a Client Component ever imports this file

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Until Phase 5 (multi-user) everything lives in the one seeded workspace.
export const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Server-side Supabase client using the SECRET key.
 * The secret key bypasses RLS, so it must never reach the browser:
 * no NEXT_PUBLIC_ prefix, and "server-only" above guards the import.
 */
export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local (locally) or set them in Vercel → Settings → Environment Variables.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
