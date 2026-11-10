// Pure auth rules: no Next.js or Supabase imports, so both proxy.ts and the
// server code can use them, and they are easy to unit-test (step 3.4).

/** Routes a signed-out visitor may open. Everything else needs a session. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login";
}

/**
 * Is this email allowed to use the app?
 * ALLOWED_EMAILS is a comma-separated list. Comparison ignores case and
 * spaces. An empty or missing list allows nobody ("fails closed"): a
 * forgotten env var locks the app instead of opening it to everyone.
 */
export function isAllowedEmail(
  email: string | null | undefined,
  allowList: string | undefined = process.env.ALLOWED_EMAILS,
): boolean {
  if (!email) return false;
  const allowed = (allowList ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/**
 * Where to send someone after sign-in. Only same-site paths are accepted:
 * "/candidates?x=1" is fine, but "https://evil.com", "//evil.com" or
 * "/\evil.com" would turn our login into an "open redirect" that phishing
 * links could abuse, so those fall back to the board.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}
