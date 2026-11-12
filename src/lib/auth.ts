import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail } from "./auth-rules";

/**
 * Supabase client that acts as the signed-in visitor. It uses the PUBLISHABLE
 * key plus the session stored in cookies, so it is only ever as powerful as
 * that visitor. (Data reads still use the secret-key `db()` client until RLS
 * lands in step 3.5; this client is for sign-in, sign-out and "who is this?".)
 */
export async function createAuthClient() {
  // connection() comes FIRST: it marks everything below as request-time work,
  // so `next build` stops here instead of running it while prerendering.
  // That matters twice: the build (CI, Vercel) has no secrets, so the env
  // check below would throw; and the Supabase client reads the clock
  // (Date.now) as soon as it's created, which prerendering forbids.
  await connection();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY (see .env.example).");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies. That's fine: proxy.ts already
          // refreshed the session cookies before this render started.
        }
      },
    },
  });
}

export type CurrentUser = { id: string; email: string };

/**
 * Who is making this request? Returns null when signed out or not allowlisted.
 *
 * getClaims() verifies the session token's signature (it doesn't just trust
 * the cookie), so a hand-edited cookie can't impersonate anyone.
 * React's cache() makes repeat calls within one request free: the board page
 * runs several queries in parallel and each checks the user.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || !isAllowedEmail(claims.email)) return null;
  return { id: claims.sub, email: claims.email as string };
});

/**
 * Data Access Layer guard: call at the top of every query and Server Action.
 * proxy.ts already redirects signed-out page visits, but Server Actions are
 * public HTTP endpoints, so each one must check for itself.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
