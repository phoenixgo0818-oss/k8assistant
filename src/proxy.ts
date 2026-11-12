import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail, isPublicPath } from "@/lib/auth-rules";

/**
 * Runs before every page request (see `matcher` below). Two jobs:
 *
 * 1. Keep the session fresh. Supabase access tokens expire after about an hour;
 *    getClaims() swaps an expired one for a new one using the refresh token,
 *    and setAll() writes the new cookies onto the response.
 * 2. Gatekeeping. Signed-out visitors (or accounts not on the allowlist) are
 *    sent to /login. Signed-in visitors on /login go to the board.
 *
 * This is the first line of defence, not the only one: requireUser() in
 * queries and Server Actions checks again (see src/lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        // Update the request too, so the page rendered after this sees the new token
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        // Supabase asks for no-cache headers when it sets auth cookies, so a CDN
        // never caches one visitor's session cookie and hands it to another
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims) && isAllowedEmail(data?.claims?.email);
  const { pathname, search } = request.nextUrl;

  // Only redirect page loads. Server Actions are POSTs and get a proper
  // redirect from requireUser(); a 307 here would confuse the action client.
  const isPageLoad = request.method === "GET" || request.method === "HEAD";

  if (!signedIn && !isPublicPath(pathname) && isPageLoad) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(login, response);
  }

  if (signedIn && pathname === "/login" && isPageLoad) {
    return redirectKeepingCookies(new URL("/", request.url), response);
  }

  return response;
}

/** A redirect must carry any refreshed session cookies, or the user is signed out. */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Everything except Next's own files and static assets (CSS, JS, images
  // must load on /login too, and checking them would only add latency).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
