"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTodo, updateTodo, type FormState } from "@/app/actions";
import type { TodoPageData } from "@/lib/queries";
import type { IsoDate, Todo } from "@/lib/todos";
import { Field, Modal, inputClass, primaryButtonClass } from "../Modal";
import { useSubmitKeepingValues } from "../useSubmitKeepingValues";

const initial: FormState = { ok: false };

type LinkOptions = TodoPageData["linkOptions"];

/** Runs `onSuccess` once per successful save (each success has a new submittedAt). */
function useOnSuccess(state: FormState, onSuccess: () => void) {
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.submittedAt !== last.current) {
      last.current = state.submittedAt;
      onSuccess();
    }
  });
}

// ---------------------------------------------------------------------------
// Field pieces shared by "add" and "edit"
// ---------------------------------------------------------------------------

/** "When": quick choices, or a specific date (the date input appears only then). */
function WhenPicker({ defaultDue, today, error }: { defaultDue: IsoDate | null; today: IsoDate; error?: string[] }) {
  const initialChoice = defaultDue === null ? "someday" : defaultDue === today ? "today" : "date";
  const [choice, setChoice] = useState(initialChoice);
  return (
    <div className="flex gap-2">
      <select
        name="due"
        aria-label="When"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className={`${inputClass} w-auto`}
      >
        <option value="today">Today</option>
        <option value="tomorrow">Tomorrow</option>
        <option value="date">Pick a date…</option>
        <option value="someday">Someday</option>
      </select>
      {choice === "date" && (
        <input
          name="dueDate"
          type="date"
          aria-label="Date"
          required
          defaultValue={defaultDue && defaultDue !== today ? defaultDue : undefined}
          aria-invalid={error ? true : undefined}
          className={`${inputClass} w-auto`}
        />
      )}
    </div>
  );
}

function PrioritySelect({ defaultValue = "normal" }: { defaultValue?: string }) {
  return (
    <select name="priority" aria-label="Priority" defaultValue={defaultValue} className={`${inputClass} w-auto`}>
      <option value="high">High</option>
      <option value="normal">Normal</option>
      <option value="low">Low</option>
    </select>
  );
}

function LinkSelect({ options, defaultValue = "" }: { options: LinkOptions; defaultValue?: string }) {
  return (
    <select name="link" aria-label="Link to" defaultValue={defaultValue} className={`${inputClass} min-w-0`}>
      <option value="">No link</option>
      {options.engineers.length > 0 && (
        <optgroup label="Engineer">
          {options.engineers.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      )}
      {options.processes.length > 0 && (
        <optgroup label="Process">
          {options.processes.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function linkValue(todo: Todo) {
  return todo.link ? `${todo.link.kind}:${todo.link.id}` : "";
}

function Errors({ state }: { state: FormState }) {
  const e = state.fieldErrors ?? {};
  const list = [...(e.title ?? []), ...(e.dueDate ?? []), ...(e.link ?? [])];
  if (state.ok || (!state.message && list.length === 0)) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {list.length ? list.join(" · ") : state.message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Quick add: always visible at the top of the page
// ---------------------------------------------------------------------------
export function QuickAddTodo({ today, linkOptions }: { today: IsoDate; linkOptions: LinkOptions }) {
  const [state, action, pending] = useActionState(createTodo, initial);
  const onSubmit = useSubmitKeepingValues(action);
  const formRef = useRef<HTMLFormElement>(null);
  // Remounting the fields (new key) resets them, including the When picker's state
  const [formKey, setFormKey] = useState(0);
  useOnSuccess(state, () => {
    setFormKey((k) => k + 1);
    // Ready for the next one: planning a day is usually several in a row
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus());
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} className="glass-inset space-y-2 rounded-2xl p-3" aria-label="Add a to-do">
      <div key={formKey} className="flex flex-wrap items-center gap-2">
        <input
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Add a to-do… e.g. Chase Northwind for feedback"
          aria-label="To-do"
          className={`${inputClass} min-w-48 flex-[2_1_16rem]`}
        />
        <WhenPicker defaultDue={today} today={today} error={state.fieldErrors?.dueDate} />
        <PrioritySelect />
        <div className="flex min-w-0 flex-[1_1_12rem]">
          <LinkSelect options={linkOptions} />
        </div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <Errors state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit: opens a dialog with every field
// ---------------------------------------------------------------------------
export function EditTodoDialog({
  todo,
  today,
  linkOptions,
  open,
  onClose,
}: {
  todo: Todo;
  today: IsoDate;
  linkOptions: LinkOptions;
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateTodo, initial);
  const onSubmit = useSubmitKeepingValues(action);
  useOnSuccess(state, onClose);
  const e = state.fieldErrors ?? {};

  return (
    <Modal open={open} onClose={onClose} title="Edit to-do">
      {/* Mount the fields only while open, so each opening starts from the saved values */}
      {open && (
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="todoId" value={todo.id} />
          <Field label="To-do *" error={e.title}>
            <input name="title" required maxLength={200} defaultValue={todo.title} className={inputClass} autoFocus />
          </Field>
          <Field label="When" error={e.dueDate}>
            <WhenPicker defaultDue={todo.dueDate} today={today} error={e.dueDate} />
          </Field>
          <Field label="Priority">
            <PrioritySelect defaultValue={todo.priority} />
          </Field>
          <Field label="Link to" error={e.link}>
            <LinkSelect options={linkOptions} defaultValue={linkValue(todo)} />
          </Field>
          {!state.ok && state.message && !Object.keys(e).length && (
            <p role="alert" className="text-sm text-red-600">{state.message}</p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
