"use client";

import { useEffect, useRef } from "react";

/**
 * Native <dialog>: the browser handles focus trapping, Escape to close,
 * and the backdrop. We only sync it with React's `open` state.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose} // Escape key
      onClick={(e) => e.target === ref.current && onClose()} // click on backdrop
      className="glass-strong m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 text-slate-900 backdrop:bg-slate-900/30 backdrop:backdrop-blur-sm dark:text-slate-100"
    >
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Small form building blocks shared by the create forms
// ---------------------------------------------------------------------------
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error.join(", ")}</p>}
    </label>
  );
}

export const inputClass = "input-field";

export const primaryButtonClass = "btn-primary";

export const secondaryButtonClass = "btn-secondary";
