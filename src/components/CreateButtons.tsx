"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createApplication, createCandidate, type FormState } from "@/app/actions";
import type { FormOptions } from "@/lib/queries";
import { Field, Modal, inputClass, primaryButtonClass, secondaryButtonClass } from "./Modal";

const initial: FormState = { ok: false };

/** Close the modal and clear the form after each successful submit */
function useCloseOnSuccess(state: FormState, close: () => void) {
  const formRef = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.submittedAt !== lastHandled.current) {
      lastHandled.current = state.submittedAt;
      formRef.current?.reset();
      close();
    }
  }, [state, close]);
  return formRef;
}

function CompanyInput({ companies, error }: { companies: string[]; error?: string[] }) {
  const listId = useId();
  return (
    <Field label="Company" error={error} hint="Pick one or type a new name; new companies are created automatically.">
      <input name="company" list={listId} className={inputClass} autoComplete="off" placeholder="Northwind Labs" />
      <datalist id={listId}>
        {companies.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </Field>
  );
}

function StageSelect({ stages }: { stages: FormOptions["stages"] }) {
  return (
    <Field label="Stage">
      <select name="stageId" className={inputClass} defaultValue={stages[0]?.id}>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// + New candidate (with optional first application)
// ---------------------------------------------------------------------------
export function NewCandidateButton({ options }: { options: FormOptions }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCandidate, initial);
  const formRef = useCloseOnSuccess(state, () => setOpen(false));
  const e = state.fieldErrors ?? {};

  return (
    <>
      <button type="button" className={primaryButtonClass} onClick={() => setOpen(true)}>
        + New candidate
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New candidate">
        <form ref={formRef} action={action} className="space-y-3">
          <Field label="Name *" error={e.name}>
            <input name="name" required autoFocus className={inputClass} placeholder="Alex Kim" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Headline" error={e.headline}>
              <input name="headline" className={inputClass} placeholder="Backend engineer" />
            </Field>
            <Field label="Email" error={e.email}>
              <input name="email" type="email" className={inputClass} placeholder="alex@example.com" />
            </Field>
          </div>
          <Field label="Skills" error={e.skills} hint="Comma-separated, e.g. Go, Postgres, Kafka">
            <input name="skills" className={inputClass} />
          </Field>

          <fieldset className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
            <legend className="px-1 text-xs font-medium text-zinc-500">First application (optional)</legend>
            <div className="space-y-3">
              <CompanyInput companies={options.companies} error={e.company} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Role" error={e.role}>
                  <input name="role" className={inputClass} placeholder="Senior Backend Engineer" />
                </Field>
                <StageSelect stages={options.stages} />
              </div>
            </div>
          </fieldset>

          {state.message && !state.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={primaryButtonClass} disabled={pending}>
              {pending ? "Saving…" : "Add candidate"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// + New application (one more process for an existing engineer)
// ---------------------------------------------------------------------------
export function NewApplicationButton({
  options,
  candidateId,
  label = "+ New application",
}: {
  options: FormOptions;
  /** Preselect (and lock) the engineer, e.g. on their own page */
  candidateId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createApplication, initial);
  const formRef = useCloseOnSuccess(state, () => setOpen(false));
  const e = state.fieldErrors ?? {};

  return (
    <>
      <button type="button" className={secondaryButtonClass} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New application">
        <form ref={formRef} action={action} className="space-y-3">
          {candidateId ? (
            <input type="hidden" name="candidateId" value={candidateId} />
          ) : (
            <Field label="Engineer *" error={e.candidateId}>
              <select name="candidateId" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Choose an engineer…
                </option>
                {options.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <CompanyInput companies={options.companies} error={e.company} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Role *" error={e.role}>
              <input name="role" required className={inputClass} placeholder="Platform Engineer" />
            </Field>
            <StageSelect stages={options.stages} />
          </div>

          {state.message && !state.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={primaryButtonClass} disabled={pending}>
              {pending ? "Saving…" : "Add application"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
