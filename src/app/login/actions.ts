"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/auth";
import { isAllowedEmail, safeNextPath } from "@/lib/auth-rules";

export type SignInState = { error?: string; email?: string };

const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

// One message for every failure. Saying "no such account" vs "wrong password"
// would let a stranger find out which emails have accounts here.
const INVALID = "Email or password is incorrect.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const email = formData.get("email")?.toString() ?? "";
  if (!parsed.success) return { error: INVALID, email };

  // Check the allowlist before even asking Supabase, so a non-allowlisted
  // account never gets a session cookie.
  if (!isAllowedEmail(parsed.data.email)) return { error: INVALID, email };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Supabase limits sign-in attempts per IP; say so instead of "incorrect"
    if (error.status === 429) return { error: "Too many attempts. Wait a minute and try again.", email };
    return { error: INVALID, email };
  }

  // signInWithPassword stored the session in cookies via createAuthClient's setAll
  redirect(safeNextPath(parsed.data.next));
}

export async function signOut() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut(); // clears the session cookies
  redirect("/login");
}
