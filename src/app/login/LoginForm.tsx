"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

/**
 * Uses <form action={...}> (not onSubmit) on purpose: React then renders a
 * real POST form, so submitting before JavaScript has loaded still goes to
 * the Server Action. An onSubmit-only form would fall back to a GET and put
 * the password in the URL. After a failed attempt React clears the form;
 * the email comes back via defaultValue, the password stays cleared.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex w-full flex-col gap-3 text-left">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          className="input-field font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        Password
        <input name="password" type="password" required autoComplete="current-password" className="input-field font-normal" />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
