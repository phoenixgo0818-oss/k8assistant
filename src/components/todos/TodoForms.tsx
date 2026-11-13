"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTodo, updateTodo, type FormState } from "@/app/actions";
import type { UpcomingData } from "@/lib/queries";
import type { IsoDate, Todo } from "@/lib/todos";
import { Field, Modal, inputClass, primaryButtonClass } from "../Modal";
import { useSubmitKeepingValues } from "../useSubmitKeepingValues";

const initial: FormState = { ok: false };

type LinkOptions = UpcomingData["linkOptions"];

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

/** "When": Today, Tomorrow, or a specific date (the date input appears only then). */
function WhenPicker({ defaultDue, today }: { defaultDue: IsoDate; today: IsoDate }) {
  const [choice, setChoice] = useState(defaultDue === today ? "today" : "date");
  return (
    <div className="flex flex-wrap gap-2">
      <select name="due" aria-label="When" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${inputClass} w-auto`}>
        <option value="today">Today</option>
        <option value="tomorrow">Tomorrow</option>
        <option value="date">Pick a date…</option>
      </select>
      {choice === "date" && (
        <input
          name="dueDate"
          type="date"
          aria-label="Date"
          required
          defaultValue={defaultDue !== today ? defaultDue : undefined}
          className={`${inputClass} w-auto`}
        />
      )}
    </div>
  );
}

function LinkSelect({ options, defaultValue = "" }: { options: LinkOptions; defaultValue?: string }) {
  return (
    <select name="link" aria-label="Link to" defaultValue={defaultValue} className={inputClass}>
      <option value="">No link</option>
      {options.processes.length > 0 && (
        <optgroup label="Process">
          {options.processes.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      )}
      {options.engineers.length > 0 && (
        <optgroup label="Engineer">
          {options.engineers.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

/**
 * One dialog for both "add" and "edit". With `todo` it edits that event;
 * without, it creates a new one (defaulting to today).
 */
export function EventDialog({
  todo,
  today,
  linkOptions,
  open,
  onClose,
}: {
  todo?: Todo;
  today: IsoDate;
  linkOptions: LinkOptions;
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(todo ? updateTodo : createTodo, initial);
  const onSubmit = useSubmitKeepingValues(action);
  useOnSuccess(state, onClose);
  const e = state.fieldErrors ?? {};

  return (
    <Modal open={open} onClose={onClose} title={todo ? "Edit event" : "New event"}>
      {/* Mount the fields only while open, so each opening starts fresh */}
      {open && (
        <form onSubmit={onSubmit} className="space-y-3">
          {todo && <input type="hidden" name="todoId" value={todo.id} />}
          <Field label="What *" error={e.title}>
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={todo?.title}
              placeholder="e.g. Tech call with Cobalt Pay"
              className={inputClass}
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="When" error={e.dueDate}>
              <WhenPicker defaultDue={todo?.dueDate ?? today} today={today} />
            </Field>
            <Field label="Time" error={e.dueTime} hint="Optional">
              <input name="dueTime" type="time" defaultValue={todo?.dueTime ?? ""} className={`${inputClass} w-auto`} />
            </Field>
          </div>
          <Field label="Link to" error={e.link}>
            <LinkSelect options={linkOptions} defaultValue={todo?.link ? `${todo.link.kind}:${todo.link.id}` : ""} />
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue={todo?.priority ?? "normal"} className={`${inputClass} w-auto`}>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </Field>
          {!state.ok && state.message && !Object.keys(e).length && (
            <p role="alert" className="text-sm text-red-600">{state.message}</p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? "Saving…" : todo ? "Save" : "Add event"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function AddEventButton({ today, linkOptions }: { today: IsoDate; linkOptions: LinkOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary px-3 py-1 text-xs">
        + Add event
      </button>
      <EventDialog today={today} linkOptions={linkOptions} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
