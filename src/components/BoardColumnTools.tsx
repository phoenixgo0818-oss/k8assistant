"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createStage, deleteStage, moveStage, updateStage, type FormState } from "@/app/actions";
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
// "⋯" on a column header → settings: edit, move, collapse, remove
// ---------------------------------------------------------------------------
type ColumnInfo = { id: string; name: string; color: string; isFinal: boolean; cardCount: number };

function ColorChoices({ name, defaultValue }: { name: string; defaultValue: string }) {
  const fallback = LABEL_COLORS.includes(defaultValue as (typeof LABEL_COLORS)[number]) ? defaultValue : LABEL_COLORS[8];
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
      {LABEL_COLORS.map((c) => (
        <label key={c} className="cursor-pointer">
          <input type="radio" name={name} value={c} defaultChecked={c === fallback} className="peer sr-only" aria-label={`Colour ${c}`} />
          <span
            className="block size-6 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900/70 dark:peer-checked:ring-white/80"
            style={{ backgroundColor: c }}
          />
        </label>
      ))}
    </div>
  );
}

export function ColumnSettingsButton({
  column,
  otherColumns,
  isFirst,
  isLast,
  collapsed,
  onToggleCollapse,
}: {
  column: ColumnInfo;
  otherColumns: { id: string; name: string }[];
  isFirst: boolean;
  isLast: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(otherColumns[0]?.id ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action, saving] = useActionState(updateStage, initial);
  const onSubmit = useSubmitKeepingValues(action);

  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.submittedAt !== last.current) {
      last.current = state.submittedAt;
      setOpen(false);
    }
  }, [state]);

  const move = (direction: -1 | 1) =>
    startTransition(async () => {
      const r = await moveStage({ stageId: column.id, direction });
      if (!r.ok) setError("Couldn't move the column.");
    });

  return (
    <>
      <button
        type="button"
        aria-label={`Column options for ${column.name}`}
        title="Column options"
        onClick={() => {
          setError(null);
          setConfirmRemove(false);
          setTarget(otherColumns[0]?.id ?? "");
          setOpen(true);
        }}
        className="rounded-full bg-white/95 px-1.5 text-xs leading-5 text-slate-500 opacity-0 shadow-sm transition group-hover/col:opacity-100 hover:text-slate-900 focus-visible:opacity-100 dark:bg-slate-800 dark:text-slate-300"
      >
        ⋯
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Column: ${column.name}`}>
        <div className="space-y-5 text-sm text-slate-700 dark:text-slate-300">
          {/* Edit */}
          <form onSubmit={onSubmit} className="space-y-3" key={`${column.id}:${column.name}:${column.color}:${column.isFinal}`}>
            <input type="hidden" name="stageId" value={column.id} />
            <label className="block">
              <span className="font-medium">Name</span>
              <input name="name" required maxLength={40} defaultValue={column.name} className={`${inputClass} mt-1`} />
            </label>
            {state.fieldErrors?.name && <p className="text-xs text-red-600">{state.fieldErrors.name.join(", ")}</p>}
            <div>
              <span className="font-medium">Colour</span>
              <ColorChoices name="color" defaultValue={column.color} />
            </div>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="isFinal" defaultChecked={column.isFinal} className="mt-0.5 size-4 accent-[#007acc]" />
              <span>
                <span className="font-medium">Final column</span>
                <span className="block text-xs text-slate-500">The process ends here (like Hired or Rejected). Shown slightly faded.</span>
              </span>
            </label>
            {!state.ok && state.message && <p className="text-xs text-red-600">{state.message}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>

          {/* Position and view */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
            <button type="button" className={secondaryButtonClass} disabled={isFirst || pending} onClick={() => move(-1)}>
              ← Move left
            </button>
            <button type="button" className={secondaryButtonClass} disabled={isLast || pending} onClick={() => move(1)}>
              Move right →
            </button>
            <button
              type="button"
              className={`${secondaryButtonClass} ml-auto`}
              onClick={() => {
                onToggleCollapse();
                setOpen(false);
              }}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>

          {/* Remove */}
          <div className="border-t border-slate-200/70 pt-4 dark:border-white/10">
            {!confirmRemove ? (
              <button type="button" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400" onClick={() => setConfirmRemove(true)}>
                Remove column…
              </button>
            ) : otherColumns.length === 0 ? (
              <p>This is the only column; the board needs at least one.</p>
            ) : (
              <div className="space-y-3">
                {column.cardCount > 0 ? (
                  <label className="block">
                    It has <strong>{column.cardCount} card{column.cardCount === 1 ? "" : "s"}</strong>. Move {column.cardCount === 1 ? "it" : "them"} to:
                    <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} mt-2`} aria-label="Move cards to">
                      {otherColumns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-slate-500">Cards go to the bottom of that column; each move is recorded in its history.</span>
                  </label>
                ) : (
                  <p>The column is empty. Notes written during this stage keep their text but lose the stage name.</p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" className={secondaryButtonClass} onClick={() => setConfirmRemove(false)}>
                    Keep it
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-red-500/25 hover:brightness-110 disabled:opacity-50"
                    onClick={() =>
                      startTransition(async () => {
                        // Even a column that looks empty may hold hidden cards of archived
                        // engineers, so always send a target; the server only uses it if needed.
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
            )}
          </div>
          {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
