"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addNote, changeStage, createLabelOnCard, deleteNote, setLabel, updateNote, updateProfile, type FormState } from "@/app/actions";
import { LABEL_COLORS } from "@/lib/constants";
import type { ApplicationDetail, Label, Note } from "@/lib/queries";
import { LabelChip } from "../LabelChip";
import { useSubmitKeepingValues } from "../useSubmitKeepingValues";
import { Field, inputClass, primaryButtonClass, secondaryButtonClass } from "../Modal";

const initial: FormState = { ok: false };

// ---------------------------------------------------------------------------
// Shell: the sliding panel. Escape or ✕ closes it (= go back to plain "/").
// ---------------------------------------------------------------------------
export function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't steal Escape from an open dialog or a text field being edited
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.blur();
        return;
      }
      router.push("/", { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <aside
      aria-label={title}
      className="glass-strong fixed inset-y-0 right-0 z-20 flex w-full flex-col rounded-none border-y-0 border-r-0 shadow-2xl shadow-blue-900/10 sm:top-14 sm:w-[30rem]"
    >
      <div className="flex items-center justify-end border-b border-white/60 px-3 py-2 dark:border-slate-700/60">
        <Link
          href="/"
          scroll={false}
          aria-label="Close panel"
          className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ✕
        </Link>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">{children}</div>
    </aside>
  );
}

/** Formats in the viewer's own timezone (the server runs in UTC) */
export function LocalTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}

function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.submittedAt !== last.current) {
      last.current = state.submittedAt;
      ref.current?.reset();
    }
  }, [state]);
  return ref;
}

// ---------------------------------------------------------------------------
// Stage dropdown
// ---------------------------------------------------------------------------
export function StagePicker({ detail }: { detail: ApplicationDetail }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">Stage</span>
      <select
        key={detail.stageId} // re-sync if the card is moved elsewhere (e.g. dragged)
        defaultValue={detail.stageId}
        disabled={pending}
        className={`${inputClass} mt-1`}
        onChange={(e) => {
          const stageId = e.target.value;
          setError(false);
          startTransition(async () => {
            const r = await changeStage({ applicationId: detail.id, stageId });
            if (!r.ok) setError(true);
          });
        }}
      >
        {detail.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">Couldn&apos;t change the stage.</p>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Labels: click a chip to toggle it; create a new one on the spot
// ---------------------------------------------------------------------------
export function LabelPicker({ detail }: { detail: ApplicationDetail }) {
  const [pending, startTransition] = useTransition();
  // Optimistic: flip immediately, server confirms via refresh()
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [prevLabels, setPrevLabels] = useState(detail.labels);
  if (prevLabels !== detail.labels) {
    setPrevLabels(detail.labels);
    setOptimistic({});
  }
  const isOn = (l: Label) => optimistic[l.id] ?? detail.labels.some((x) => x.id === l.id);

  const [creating, setCreating] = useState(false);
  const [state, action, saving] = useActionState(createLabelOnCard, initial);
  const onSubmit = useSubmitKeepingValues(action);
  const formRef = useResetOnSuccess(state);

  return (
    <section>
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Labels</h3>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-busy={pending}>
        {detail.allLabels.map((l) => {
          const on = isOn(l);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setOptimistic((o) => ({ ...o, [l.id]: !on }));
                startTransition(async () => {
                  await setLabel({ applicationId: detail.id, labelId: l.id, on: !on });
                });
              }}
              className={`rounded-full transition ${on ? "" : "opacity-40 grayscale hover:opacity-80 hover:grayscale-0"}`}
              title={on ? `Remove “${l.name}”` : `Add “${l.name}”`}
            >
              <LabelChip label={l} />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-slate-400 dark:border-slate-700"
        >
          + New label
        </button>
      </div>

      {creating && (
        <form ref={formRef} onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="applicationId" value={detail.id} />
          <input name="name" required maxLength={40} placeholder="Visa needed" className={`${inputClass} w-40`} />
          <div className="flex gap-1" role="radiogroup" aria-label="Color">
            {LABEL_COLORS.map((c, i) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="color" value={c} defaultChecked={i === 3} className="peer sr-only" />
                <span
                  className="block size-5 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900 dark:ring-offset-slate-950 dark:peer-checked:ring-slate-100"
                  style={{ backgroundColor: c }}
                />
              </label>
            ))}
          </div>
          <button type="submit" disabled={saving} className={secondaryButtonClass}>
            {saving ? "Adding…" : "Add"}
          </button>
          {state.message && !state.ok && <p className="w-full text-xs text-red-600">{state.message}</p>}
          {state.fieldErrors?.name && <p className="w-full text-xs text-red-600">{state.fieldErrors.name.join(", ")}</p>}
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
export function NoteForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(addNote, initial);
  const onSubmit = useSubmitKeepingValues(action);
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <textarea
        name="body"
        required
        rows={3}
        maxLength={5000}
        placeholder="Call summary, interview feedback…"
        className={inputClass}
        onKeyDown={(e) => {
          // Ctrl/Cmd + Enter submits, like most issue trackers
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Ctrl + Enter to add</span>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Adding…" : "Add note"}
        </button>
      </div>
      {(state.message || state.fieldErrors?.body) && !state.ok && (
        <p className="text-xs text-red-600">{state.fieldErrors?.body?.join(", ") ?? state.message}</p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Profile (shared by all of the engineer's processes)
// ---------------------------------------------------------------------------
export function ProfileForm({ candidate }: { candidate: ApplicationDetail["candidate"] }) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  const onSubmit = useSubmitKeepingValues(action);
  const e = state.fieldErrors ?? {};
  // Re-mount the form when saved data comes back, so inputs show DB values
  const formKey = [candidate.id, candidate.name, candidate.headline, candidate.yearsExperience, candidate.email,
    candidate.phone, candidate.skills.join(), candidate.links.join(), candidate.source, candidate.context].join("|");

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="candidateId" value={candidate.id} />
      <Field label="Name *" error={e.name}>
        <input name="name" required defaultValue={candidate.name} className={inputClass} />
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field label="Headline" error={e.headline}>
          <input name="headline" defaultValue={candidate.headline ?? ""} className={inputClass} />
        </Field>
        <Field label="Years" error={e.yearsExperience}>
          <input name="yearsExperience" type="number" min={0} max={60} defaultValue={candidate.yearsExperience ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" error={e.email}>
          <input name="email" type="email" defaultValue={candidate.email ?? ""} className={inputClass} />
        </Field>
        <Field label="Phone" error={e.phone}>
          <input name="phone" defaultValue={candidate.phone ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Skills" error={e.skills} hint="Comma-separated">
        <input name="skills" defaultValue={candidate.skills.join(", ")} className={inputClass} />
      </Field>
      <Field label="Links" error={e.links} hint="One per line (GitHub, LinkedIn, CV…)">
        <textarea name="links" rows={2} defaultValue={candidate.links.join("\n")} className={inputClass} />
      </Field>
      <Field label="Source" error={e.source}>
        <input name="source" defaultValue={candidate.source ?? ""} placeholder="Referral, LinkedIn…" className={inputClass} />
      </Field>
      <Field label="Context" error={e.context} hint="Background that rarely changes">
        <textarea name="context" rows={3} defaultValue={candidate.context ?? ""} className={inputClass} />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {state.ok && <span className="text-xs text-emerald-600">Saved ✓</span>}
        {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// One note: read, edit in place, or delete
// ---------------------------------------------------------------------------
export function NoteItem({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, action, saving] = useActionState(updateNote, initial);
  const onSubmit = useSubmitKeepingValues(action);
  const [deleting, startDelete] = useTransition();
  const [deleteFailed, setDeleteFailed] = useState(false);

  // Leave edit mode once a save succeeds
  const lastSaved = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.submittedAt !== lastSaved.current) {
      lastSaved.current = state.submittedAt;
      setEditing(false);
    }
  }, [state]);

  const meta = (
    <p className="text-xs text-slate-500">
      <LocalTime iso={note.createdAt} />
      {note.stageName && <> · during <span className="font-medium">{note.stageName}</span></>}
    </p>
  );

  if (editing) {
    return (
      <li className="rounded-xl border border-white/80 bg-white/60 p-3 text-sm dark:border-slate-700/60 dark:bg-slate-800/50">
        <form onSubmit={onSubmit} className="space-y-2">
          <input type="hidden" name="noteId" value={note.id} />
          <textarea
            name="body"
            required
            rows={4}
            maxLength={5000}
            defaultValue={note.body}
            autoFocus
            aria-label="Edit note"
            className={inputClass}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
            }}
          />
          {(state.fieldErrors?.body || (!state.ok && state.message)) && (
            <p className="text-xs text-red-600">{state.fieldErrors?.body?.join(", ") ?? state.message}</p>
          )}
          <div className="flex items-center justify-between">
            {meta}
            <div className="flex gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group rounded-xl border border-white/80 bg-white/60 p-3 text-sm dark:border-slate-700/60 dark:bg-slate-800/50">
      <p className="whitespace-pre-line text-slate-900 dark:text-slate-100">{note.body}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {meta}
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-400">Delete this note?</span>
            <button
              type="button"
              disabled={deleting}
              className="font-medium text-red-600 hover:underline"
              onClick={() =>
                startDelete(async () => {
                  const r = await deleteNote({ noteId: note.id });
                  if (!r.ok) setDeleteFailed(true);
                })
              }
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button type="button" className="text-slate-500 hover:underline" onClick={() => setConfirmDelete(false)}>
              No
            </button>
          </span>
        ) : (
          <span className="flex gap-3 text-xs">
            <button type="button" className="text-slate-500 hover:text-slate-900 hover:underline dark:hover:text-slate-100" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="text-slate-500 hover:text-red-600 hover:underline" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </span>
        )}
      </div>
      {deleteFailed && <p className="mt-1 text-xs text-red-600">Couldn&apos;t delete the note.</p>}
    </li>
  );
}
