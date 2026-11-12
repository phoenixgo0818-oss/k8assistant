"use client";

import Link from "next/link";
import { memo, useOptimistic, useState, useTransition } from "react";
import { deleteTodo, moveTodo, setTodoDone } from "@/app/actions";
import type { TodoPageData } from "@/lib/queries";
import { daysBetween, formatDay, type IsoDate, type Todo } from "@/lib/todos";
import { ConfirmAction } from "../ConfirmAction";
import { EngineerAvatar } from "../EngineerAvatar";
import { EditTodoDialog } from "./TodoForms";

const PRIORITY_STYLE = {
  high: { label: "High", className: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300" },
  normal: null, // the default: no chip, less noise
  low: { label: "Low", className: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-400" },
} as const;

const smallButton =
  "rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-white/80 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100";

type Props = { todo: Todo; today: IsoDate; linkOptions: TodoPageData["linkOptions"] };

export const TodoItem = memo(function TodoItem({ todo, today, linkOptions }: Props) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  // Optimistic UI: the tick shows instantly; React rolls it back by itself
  // if the server action fails (the real value comes back on refresh).
  const [done, setOptimisticDone] = useOptimistic(todo.doneAt !== null);

  const toggleDone = () =>
    startTransition(async () => {
      setOptimisticDone(!done);
      await setTodoDone({ todoId: todo.id, done: !done });
    });
  const move = (to: "today" | "tomorrow" | "someday") => startTransition(async () => void (await moveTodo({ todoId: todo.id, to })));

  const overdueDays = !done && todo.dueDate && todo.dueDate < today ? daysBetween(todo.dueDate, today) : 0;
  const priority = PRIORITY_STYLE[todo.priority];

  return (
    <li className={`group flex items-start gap-3 px-3 py-2.5 transition ${pending ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={toggleDone}
        aria-label={done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#007acc]"
      />

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>
          {todo.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {priority && <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ${priority.className}`}>{priority.label}</span>}
          {overdueDays > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300">
              {formatDay(todo.dueDate!, today)} · {overdueDays} {overdueDays === 1 ? "day" : "days"} late
            </span>
          )}
          {todo.carriedOver > 0 && (
            <span title="How many times this moved to a later day">↻ carried {todo.carriedOver}×</span>
          )}
          {todo.link && <LinkChip link={todo.link} />}
        </div>
      </div>

      {/* Row actions: visible on hover/focus on desktop, always on touch screens */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {!done && todo.dueDate !== today && (
          <button type="button" className={smallButton} disabled={pending} onClick={() => move("today")}>
            Today
          </button>
        )}
        {!done && (todo.dueDate === null || todo.dueDate <= today) && (
          <button type="button" className={smallButton} disabled={pending} onClick={() => move("tomorrow")}>
            Tomorrow
          </button>
        )}
        {!done && todo.dueDate !== null && (
          <button type="button" className={smallButton} disabled={pending} onClick={() => move("someday")}>
            Someday
          </button>
        )}
        <button type="button" className={smallButton} onClick={() => setEditing(true)} aria-label={`Edit "${todo.title}"`}>
          Edit
        </button>
        <ConfirmAction
          label="Delete"
          buttonClassName={`${smallButton} hover:!text-red-600`}
          title="Delete to-do?"
          message={<>“{todo.title}” will be removed for good. Tick it off instead if it&apos;s done.</>}
          confirmLabel="Delete"
          action={() => deleteTodo({ todoId: todo.id })}
        />
      </div>

      <EditTodoDialog todo={todo} today={today} linkOptions={linkOptions} open={editing} onClose={() => setEditing(false)} />
    </li>
  );
});

function LinkChip({ link }: { link: NonNullable<Todo["link"]> }) {
  // A process opens its card on the board; an engineer opens their page
  const href = link.kind === "application" ? `/?card=${link.id}` : `/candidates/${link.id}`;
  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/70 py-0.5 pr-2 pl-0.5 text-slate-700 ring-1 ring-slate-200/80 hover:bg-white dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
    >
      <EngineerAvatar name={link.name} color={link.color} size="sm" />
      <span className="truncate">
        {link.name}
        {link.kind === "application" && (
          <span className="text-slate-500"> · {link.company} – {link.role}</span>
        )}
      </span>
    </Link>
  );
}
