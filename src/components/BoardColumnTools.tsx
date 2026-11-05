"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createStage, deleteStage, type FormState } from "@/app/actions";
import { LABEL_COLORS } from "@/lib/constants";
import { Modal, inputClass, primaryButtonClass, secondaryButtonClass } from "./Modal";
import { useSubmitKeepingValues } from "./useSubmitKeepingValues";

const initial: FormState = { ok: false };

// ---------------------------------------------------------------------------
// "+ Column" tile at the end of the board
// ---------------------------------------------------------------------------
export function AddColumnTile() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createStage, initial);
  const onSubmit = useSubmitKeepingValues(action);
  const formRef = useRef<HTMLFormElement>(null);
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.submittedAt !== last.current) {
      last.current = state.submittedAt;
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-[var(--col-w)] shrink-0 items-start justify-center rounded-2xl border-2 border-dashed border-white/40 p-3 text-sm font-medium text-white/85 transition hover:border-white/80 hover:bg-white/10 hover:text-white"
      >
        + Column
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New column">
        <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Name *</span>
            <input name="name" required maxLength={40} placeholder="Take-home review" className={`${inputClass} mt-1`} />
          </label>
          {state.fieldErrors?.name && <p className="text-xs text-red-600">{state.fieldErrors.name.join(", ")}</p>}
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Colour</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
              {LABEL_COLORS.map((c, i) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="color" value={c} defaultChecked={i === 4} className="peer sr-only" />
                  <span
                    className="block size-6 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900/70 dark:peer-checked:ring-white/80"
                    style={{ backgroundColor: c }}
                  />
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">New columns are added just before the final columns (Hired / Rejected).</p>
          {!state.ok && state.message && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? "Adding…" : "Add column"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// "⋯" on a column header → remove the column (moving its cards elsewhere)
// ---------------------------------------------------------------------------
export function RemoveColumnButton({
  column,
  otherColumns,
}: {
  column: { id: string; name: string; cardCount: number };
  otherColumns: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(otherColumns[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        aria-label={`Column options for ${column.name}`}
        title="Remove column"
        onClick={() => {
          setError(null);
          setTarget(otherColumns[0]?.id ?? "");
          setOpen(true);
        }}
        className="rounded-full bg-white/95 px-1.5 text-xs leading-5 text-slate-500 opacity-0 shadow-sm transition group-hover/col:opacity-100 hover:text-slate-900 focus-visible:opacity-100 dark:bg-slate-800 dark:text-slate-300"
      >
        ⋯
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Remove “${column.name}”?`}>
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          {otherColumns.length === 0 ? (
            <p>This is the only column; the board needs at least one.</p>
          ) : column.cardCount > 0 ? (
            <label className="block">
              It has <strong>{column.cardCount} card{column.cardCount === 1 ? "" : "s"}</strong>. Move {column.cardCount === 1 ? "it" : "them"} to:
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} mt-2`}>
                {otherColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                Cards go to the bottom of that column; each move is recorded in its history.
              </span>
            </label>
          ) : (
            <p>The column is empty. Notes written during this stage keep their text but lose the stage name.</p>
          )}
          {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || otherColumns.length === 0}
              className="inline-flex items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-red-500/25 hover:brightness-110 disabled:opacity-50"
              onClick={() =>
                startTransition(async () => {
                  // Even a column that looks empty may hold hidden cards of archived engineers,
                  // so always send a target; the server only uses it if needed.
                  const r = await deleteStage({ stageId: column.id, targetStageId: target || null });
                  if (!r.ok) setError(r.message ?? "Couldn't remove the column.");
                  else setOpen(false);
                })
              }
            >
              {pending ? "Removing…" : "Remove column"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
