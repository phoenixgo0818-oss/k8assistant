"use client";

import Link from "next/link";
import { memo, useOptimistic, useState, useTransition } from "react";
import { deleteTodo, moveTodo, setTodoDone } from "@/app/actions";
import type { UpcomingData } from "@/lib/queries";
import { daysBetween, formatDay, isLate, type IsoDate, type Todo } from "@/lib/todos";
import { ConfirmAction } from "../ConfirmAction";
import { EngineerAvatar } from "../EngineerAvatar";
import { EventDialog } from "./TodoForms";

const smallButton =
  "rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-white/80 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100";

type Props = { todo: Todo; today: IsoDate; linkOptions: UpcomingData["linkOptions"] };

/** One event: when · what · who · priority, with tick/move/edit/delete. */
export const EventRow = memo(function EventRow({ todo, today, linkOptions }: Props) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  // Optimistic UI: the tick shows instantly; React rolls it back by itself
  // if the action fails. Once saved, the event leaves the list.
  const [done, setOptimisticDone] = useOptimistic(todo.doneAt !== null);

  const toggleDone = () =>
    startTransition(async () => {
      setOptimisticDone(!done);
      await setTodoDone({ todoId: todo.id, done: !done });
    });
  const move = (to: "today" | "tomorrow") => startTransition(async () => void (await moveTodo({ todoId: todo.id, to })));

  const late = isLate(todo, today);
  const lateDays = late ? daysBetween(todo.dueDate, today) : 0;
  const isToday = todo.dueDate === today;

  return (
    <li className={`group flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 transition sm:flex-nowrap ${pending ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={toggleDone}
        aria-label={`Mark "${todo.title}" as done`}
        className="size-4 shrink-0 cursor-pointer accent-[#007acc]"
      />

      {/* When */}
      <span
        className={`w-32 shrink-0 text-xs tabular-nums ${
          late ? "font-semibold text-amber-700 dark:text-amber-300" : isToday ? "font-semibold text-[#0065a9] dark:text-[#7cc4f7]" : "text-slate-600 dark:text-slate-400"
        }`}
        title={late ? `${lateDays} ${lateDays === 1 ? "day" : "days"} late` : undefined}
      >
        {formatDay(todo.dueDate, today)}
        {todo.dueTime && <> · {todo.dueTime}</>}
        {late && <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium">late</span>}
      </span>

      {/* What */}
      <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-slate-400 line-through" : "text-slate-900 dark:text-slate-100"}`} title={todo.title}>
        {todo.priority === "high" && <span className="mr-1.5 inline-block size-2 rounded-full bg-red-500 align-middle" title="High priority" aria-label="High priority" />}
        {todo.title}
        {todo.carriedOver > 0 && <span className="ml-2 text-xs text-slate-500" title="Times moved to a later day">↻{todo.carriedOver}</span>}
      </span>

      {/* Who */}
      {todo.link && <LinkChip link={todo.link} />}

      {/* Actions: on hover/focus on desktop, always on touch screens */}
      <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {late && (
          <button type="button" className={smallButton} disabled={pending} onClick={() => move("today")}>
            Today
          </button>
        )}
        {(late || isToday) && (
          <button type="button" className={smallButton} disabled={pending} onClick={() => move("tomorrow")}>
            Tomorrow
          </button>
        )}
        <button type="button" className={smallButton} onClick={() => setEditing(true)} aria-label={`Edit "${todo.title}"`}>
          Edit
        </button>
        <ConfirmAction
          label="Delete"
          buttonClassName={`${smallButton} hover:!text-red-600`}
          title="Delete event?"
          message={<>“{todo.title}” will be removed for good. Tick it off instead if it&apos;s done.</>}
          confirmLabel="Delete"
          action={() => deleteTodo({ todoId: todo.id })}
        />
      </div>

      <EventDialog todo={todo} today={today} linkOptions={linkOptions} open={editing} onClose={() => setEditing(false)} />
    </li>
  );
});

function LinkChip({ link }: { link: NonNullable<Todo["link"]> }) {
  // A process opens its card on the board; an engineer opens their page
  const href = link.kind === "application" ? `/?card=${link.id}` : `/candidates/${link.id}`;
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex max-w-full shrink items-center gap-1.5 rounded-full bg-white/70 py-0.5 pr-2 pl-0.5 text-xs text-slate-700 ring-1 ring-slate-200/80 hover:bg-white sm:max-w-[45%] dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
    >
      <EngineerAvatar name={link.name} color={link.color} size="sm" />
      <span className="truncate">
        {link.name}
        {link.kind === "application" && <span className="text-slate-500"> · {link.company} – {link.role}</span>}
      </span>
    </Link>
  );
}
