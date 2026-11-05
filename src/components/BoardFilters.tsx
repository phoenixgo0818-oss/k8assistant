"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteLabel, updateLabel, type FormState } from "@/app/actions";
import { LABEL_COLORS } from "@/lib/constants";
import type { ApplicationCard, Label } from "@/lib/queries";
import { LabelChip } from "./LabelChip";
import { Modal, inputClass, primaryButtonClass, secondaryButtonClass } from "./Modal";
import { useSubmitKeepingValues } from "./useSubmitKeepingValues";

// ---------------------------------------------------------------------------
// Filter model + matching (pure functions: easy to unit-test in Phase 3)
// ---------------------------------------------------------------------------
export type Filters = { text: string; labelIds: string[]; company: string };
export const NO_FILTERS: Filters = { text: "", labelIds: [], company: "" };

export const isFiltering = (f: Filters) => f.text.trim() !== "" || f.labelIds.length > 0 || f.company !== "";

/**
 * A card matches when:
 * - every search word appears in its name, company, role or skills, and
 * - it has ANY of the selected labels (if labels are selected), and
 * - it's at the selected company (if one is selected).
 */
export function matches(card: ApplicationCard, f: Filters): boolean {
  if (f.company && card.company.name !== f.company) return false;
  if (f.labelIds.length > 0 && !card.labels.some((l) => f.labelIds.includes(l.id))) return false;
  const words = f.text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [card.candidate.name, card.company.name, card.role, ...card.candidate.skills].join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}

// ---------------------------------------------------------------------------
// Filter bar (sits on the blue backdrop above the board)
// ---------------------------------------------------------------------------
export function FilterBar({
  filters,
  onChange,
  labels,
  companies,
  shown,
  total,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  labels: Label[];
  companies: string[];
  shown: number;
  total: number;
}) {
  const active = isFiltering(filters);
  const toggleLabel = (id: string) =>
    onChange({
      ...filters,
      labelIds: filters.labelIds.includes(id) ? filters.labelIds.filter((x) => x !== id) : [...filters.labelIds, id],
    });

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6" role="search">
      <input
        type="search"
        value={filters.text}
        onChange={(e) => onChange({ ...filters, text: e.target.value })}
        placeholder="Search name, skill, company, role…"
        aria-label="Search cards"
        className="w-64 rounded-xl border border-white/50 bg-white/85 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus:bg-white focus:ring-4 focus:ring-white/30 dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-white/50"
      />
      <select
        value={filters.company}
        onChange={(e) => onChange({ ...filters, company: e.target.value })}
        aria-label="Filter by company"
        className="rounded-xl border border-white/50 bg-white/85 px-2.5 py-1.5 text-sm text-slate-800 shadow-sm outline-none dark:border-white/15 dark:bg-slate-800 dark:text-white"
      >
        <option value="">All companies</option>
        {companies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-1" aria-label="Filter by label">
        {labels.map((l) => {
          const on = filters.labelIds.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleLabel(l.id)}
              className={`rounded-full bg-white/90 transition dark:bg-slate-900/80 ${on ? "ring-2 ring-white shadow" : "opacity-70 hover:opacity-100"}`}
            >
              <LabelChip label={l} />
            </button>
          );
        })}
        <LabelsManager labels={labels} />
      </div>
      {active && (
        <>
          <span className="text-sm text-on-backdrop-muted">
            Showing {shown} of {total}
          </span>
          <button type="button" onClick={() => onChange(NO_FILTERS)} className="text-sm font-medium text-on-backdrop underline-offset-2 hover:underline">
            Clear filters
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Labels manager: rename, recolour, delete
// ---------------------------------------------------------------------------
function LabelsManager({ labels }: { labels: Label[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 rounded-full border border-white/40 px-2 py-0.5 text-[11px] font-medium text-white/90 hover:border-white hover:text-white"
      >
        Manage labels
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Labels">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          Rename or recolour a label everywhere at once. New labels are created from a card&apos;s panel.
        </p>
        <ul className="space-y-2">
          {labels.map((l) => (
            <LabelRow key={`${l.id}:${l.name}:${l.color}`} label={l} />
          ))}
        </ul>
      </Modal>
    </>
  );
}

const initial: FormState = { ok: false };

function LabelRow({ label }: { label: Label }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, action, saving] = useActionState(updateLabel, initial);
  const onSubmit = useSubmitKeepingValues(action);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.submittedAt !== last.current) {
      last.current = state.submittedAt;
      setEditing(false);
    }
  }, [state]);

  if (editing) {
    return (
      <li className="glass-inset rounded-xl p-3">
        <form onSubmit={onSubmit} className="space-y-2">
          <input type="hidden" name="labelId" value={label.id} />
          <input name="name" required maxLength={40} defaultValue={label.name} aria-label="Label name" className={inputClass} autoFocus />
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
            {LABEL_COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="color" value={c} defaultChecked={c === label.color} className="peer sr-only" aria-label={`Colour ${c}`} />
                <span className="block size-5 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900/70" style={{ backgroundColor: c }} />
              </label>
            ))}
          </div>
          {(state.fieldErrors?.name || (!state.ok && state.message)) && (
            <p className="text-xs text-red-600">{state.fieldErrors?.name?.join(", ") ?? state.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="glass-inset flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
      <LabelChip label={label} />
      <span className="ml-auto flex items-center gap-3 text-xs">
        {confirmDelete ? (
          <>
            <span className="text-slate-600 dark:text-slate-400">Remove from all cards and delete?</span>
            <button
              type="button"
              disabled={deleting}
              className="font-medium text-red-600 hover:underline"
              onClick={() =>
                startDelete(async () => {
                  const r = await deleteLabel({ labelId: label.id });
                  if (!r.ok) setError(r.message ?? "Couldn't delete.");
                })
              }
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button type="button" className="text-slate-500 hover:underline" onClick={() => setConfirmDelete(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button type="button" className="text-slate-600 hover:underline dark:text-slate-300" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="text-slate-500 hover:text-red-600 hover:underline" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </>
        )}
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}
