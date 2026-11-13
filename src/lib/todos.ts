// To-do / event rules as pure functions: no database, no React, no "now"
// hidden inside. "today" is always passed in, which makes them easy to
// unit-test (step 3.4) and keeps server and browser agreeing on the day.

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
  dueDate: IsoDate;
  dueTime: string | null; // "HH:MM"; null = any time that day
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

/** Human label for a day: "Today", "Tomorrow", "Yesterday", "Mon 16 Nov". */
export function formatDay(date: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Postgres returns "15:00:00"; show "15:00". */
export function formatTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

// ---------------------------------------------------------------------------
// The board's "Upcoming" list
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

/**
 * Time order: by day, then all-day items first (like a calendar), then by
 * time, then high priority first. Late items (an earlier day, still open)
 * naturally come first, so nothing unfinished drops out of sight.
 */
export function compareEvents(a: Todo, b: Todo): number {
  return (
    a.dueDate.localeCompare(b.dueDate) || // YYYY-MM-DD strings sort like dates
    (a.dueTime ?? "").localeCompare(b.dueTime ?? "") || // "" (all day) sorts before "09:30"
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

/** Open events in time order. Finished ones leave the list. */
export function upcomingEvents(todos: Todo[]): Todo[] {
  return todos.filter((t) => t.doneAt === null).sort(compareEvents);
}

export function isLate(todo: Todo, today: IsoDate): boolean {
  return todo.doneAt === null && todo.dueDate < today;
}

/** Turn a "When" choice from a form into a date: "today" | "tomorrow" | "YYYY-MM-DD". */
export function resolveDue(when: string, today: IsoDate): IsoDate {
  if (when === "today") return today;
  if (when === "tomorrow") return addDays(today, 1);
  return when; // already validated as YYYY-MM-DD by the caller
}
