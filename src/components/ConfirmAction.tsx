"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal, secondaryButtonClass } from "./Modal";

const tones = {
  danger: "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50",
  neutral:
    "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900",
};

/**
 * A button that asks "are you sure?" in a dialog before running `action`.
 * Use it for anything destructive or hard to undo.
 */
export function ConfirmAction({
  label,
  title,
  message,
  confirmLabel,
  action,
  tone = "danger",
  redirectTo,
  buttonClassName = secondaryButtonClass,
}: {
  label: string;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  action: () => Promise<{ ok: boolean; message?: string }>;
  tone?: keyof typeof tones;
  /** Where to go afterwards, e.g. away from a page whose subject was deleted */
  redirectTo?: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => { setError(null); setOpen(true); }}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <div>{message}</div>
          {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              className={tones[tone]}
              onClick={() =>
                startTransition(async () => {
                  const result = await action();
                  if (!result.ok) {
                    setError(result.message ?? "Something went wrong. Please try again.");
                    return;
                  }
                  setOpen(false);
                  if (redirectTo) {
                    // The target page may be cached from before the change
                    // (e.g. a list that still shows what we just deleted),
                    // so navigate and then re-fetch it from the server.
                    router.push(redirectTo, { scroll: false });
                    router.refresh();
                  }
                })
              }
            >
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
