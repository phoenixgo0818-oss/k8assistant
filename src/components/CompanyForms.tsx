"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createCompany, updateCompany, type FormState } from "@/app/actions";
import { Field, Modal, inputClass, primaryButtonClass } from "./Modal";
import { useSubmitKeepingValues } from "./useSubmitKeepingValues";

const initial: FormState = { ok: false };

function CompanyFields({ state, defaults }: { state: FormState; defaults?: { name: string; website: string | null; context: string | null } }) {
  const e = state.fieldErrors ?? {};
  return (
    <>
      <Field label="Name *" error={e.name}>
        <input name="name" required maxLength={120} defaultValue={defaults?.name} className={inputClass} placeholder="Northwind Labs" />
      </Field>
      <Field label="Website" error={e.website}>
        <input name="website" type="url" defaultValue={defaults?.website ?? ""} className={inputClass} placeholder="https://…" />
      </Field>
      <Field label="Notes about this company" error={e.context} hint="Process, culture, what they look for, contacts…">
        <textarea name="context" rows={4} maxLength={5000} defaultValue={defaults?.context ?? ""} className={inputClass} />
      </Field>
    </>
  );
}

export function NewCompanyButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCompany, initial);
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
      <button type="button" className={primaryButtonClass} onClick={() => setOpen(true)}>
        + New company
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New company">
        <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
          <CompanyFields state={state} />
          {!state.ok && state.message && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? "Saving…" : "Add company"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function EditCompanyForm({ company }: { company: { id: string; name: string; website: string | null; context: string | null } }) {
  const [state, action, pending] = useActionState(updateCompany, initial);
  const onSubmit = useSubmitKeepingValues(action);
  // Remount with fresh values after a save
  const key = [company.name, company.website, company.context].join("|");

  return (
    <form key={key} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="companyId" value={company.id} />
      <CompanyFields state={state} defaults={company} />
      <div className="flex items-center justify-end gap-3">
        {state.ok && <span className="text-xs text-emerald-600">Saved ✓</span>}
        {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save company"}
        </button>
      </div>
    </form>
  );
}
