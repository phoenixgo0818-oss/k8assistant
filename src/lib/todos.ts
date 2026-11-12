// To-do rules as pure functions: no database, no React, no "now" hidden
// inside. "today" is always passed in, which makes them easy to unit-test
// (step 3.4) and keeps server and browser agreeing on what day it is.

/**
 * The app's day boundary. Everyone using the app shares one "today", in this
 * time zone. Change it here if you work from somewhere else.
 */
export const APP_TIME_ZONE = "Europe/London";

export const PRIORITIES = ["high", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Calendar date as "YYYY-MM-DD" (what Postgres `date` columns use). */
export type IsoDate = string;

export type Todo = {
  id: string;
  title: string;
  dueDate: IsoDate | null; // null = Someday
  priority: Priority;
  doneAt: string | null; // ISO timestamp
  carriedOver: number;
  link:
    | { kind: "candidate"; id: string; name: string; color: string }
    | { kind: "application"; id: string; name: string; color: string; company: string; role: string }
    | null;
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Today's date in the app time zone. `now` is a parameter so tests can fix it. */
export function todayIn(timeZone: string = APP_TIME_ZONE, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The calendar day a timestamp falls on, in the app time zone. */
export function dateOf(timestamp: string, timeZone: string = APP_TIME_ZONE): IsoDate {
  return todayIn(timeZone, new Date(timestamp));
}

/** "2026-11-13" + 1 → "2026-11-14". Done in UTC so DST changes can't shift it. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Human label for a due date: "Today", "Tomorrow", "Yesterday", "Mon 16 Nov". */
export function formatDay(date: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

// ---------------------------------------------------------------------------
// Grouping for the Today page
// ---------------------------------------------------------------------------

export type TodoSections = {
  /** Open, from an earlier day: needs a decision (carry over, reschedule, or do it) */
  earlier: Todo[];
  /** Open, due today */
  today: Todo[];
  /** Open, due later, grouped by day (in date order) */
  upcoming: { date: IsoDate; todos: Todo[] }[];
  /** Open, no day planned */
  someday: Todo[];
  /** Finished today (older finished items aren't shown) */
  doneToday: Todo[];
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

/** High priority first; then the order they arrived in (stable sort). */
export function byPriority(a: Todo, b: Todo): number {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

export function groupTodos(todos: Todo[], today: IsoDate, timeZone: string = APP_TIME_ZONE): TodoSections {
  const s: TodoSections = { earlier: [], today: [], upcoming: [], someday: [], doneToday: [] };
  const upcoming = new Map<IsoDate, Todo[]>();

  for (const t of todos) {
    if (t.doneAt) {
      if (dateOf(t.doneAt, timeZone) === today) s.doneToday.push(t);
    } else if (t.dueDate === null) s.someday.push(t);
    else if (t.dueDate < today) s.earlier.push(t); // YYYY-MM-DD strings sort like dates
    else if (t.dueDate === today) s.today.push(t);
    else upcoming.set(t.dueDate, [...(upcoming.get(t.dueDate) ?? []), t]);
  }

  // Oldest first within "earlier": the longest-waiting item is the first you see
  s.earlier.sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || byPriority(a, b));
  s.today.sort(byPriority);
  s.someday.sort(byPriority);
  s.doneToday.sort((a, b) => b.doneAt!.localeCompare(a.doneAt!)); // most recent first
  s.upcoming = [...upcoming.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, todos: list.sort(byPriority) }));
  return s;
}

/**
 * Turn a "when" choice from a form into a due date.
 * "today" | "tomorrow" | "someday" | an explicit "YYYY-MM-DD".
 */
export function resolveDue(when: string, today: IsoDate): IsoDate | null {
  if (when === "today") return today;
  if (when === "tomorrow") return addDays(today, 1);
  if (when === "someday") return null;
  return when; // already validated as YYYY-MM-DD by the caller
}
