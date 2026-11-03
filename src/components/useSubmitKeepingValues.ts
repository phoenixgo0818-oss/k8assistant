"use client";

import { startTransition } from "react";

/**
 * React 19 resets a <form action={...}> after EVERY submit, even when the
 * server rejected it, so a validation error would wipe what the user typed.
 *
 * Submitting via onSubmit instead keeps the inputs; each form clears itself
 * only after a successful save (see the useResetOnSuccess / formKey logic).
 */
export function useSubmitKeepingValues(dispatch: (formData: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
