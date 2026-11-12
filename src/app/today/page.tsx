import type { Metadata } from "next";
import { getTodoPage, type TodoPageData } from "@/lib/queries";
import { formatDay, groupTodos, type Todo } from "@/lib/todos";
import { CarryOverButton } from "@/components/todos/CarryOverButton";
import { QuickAddTodo } from "@/components/todos/TodoForms";
import { TodoItem } from "@/components/todos/TodoItem";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const data = await getTodoPage();
  const { today, linkOptions } = data;
  // Pure function (src/lib/todos.ts): which to-do goes in which section
  const s = groupTodos(data.todos, today);
  const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${today}T00:00:00Z`),
  );
  const openToday = s.today.length + s.earlier.length;

  return (
    <main className="mx-auto my-6 w-[calc(100%-2rem)] max-w-4xl rounded-3xl glass-strong px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Today</h1>
        <p className="mt-1 text-sm text-slate-500">
          {longDate} · {openToday === 0 ? "nothing open" : `${openToday} open`}
          {s.doneToday.length > 0 && ` · ${s.doneToday.length} done`}
        </p>
      </div>

      <div className="mt-5">
        <QuickAddTodo today={today} linkOptions={linkOptions} />
      </div>

      {s.earlier.length > 0 && (
        <Section
          title="From earlier"
          hint="Not finished on their day. Do them, move them, or let them go."
          tone="amber"
          action={<CarryOverButton count={s.earlier.length} />}
          todos={s.earlier}
          data={data}
        />
      )}

      <Section title="Today" todos={s.today} data={data} empty="Nothing planned for today yet. Add the first thing above." />

      {s.upcoming.map((day) => (
        <Section key={day.date} title={formatDay(day.date, today)} todos={day.todos} data={data} />
      ))}

      {s.someday.length > 0 && <Section title="Someday" hint="No day planned yet." todos={s.someday} data={data} />}

      {s.doneToday.length > 0 && <Section title="Done today" todos={s.doneToday} data={data} />}
    </main>
  );
}

function Section({
  title,
  hint,
  tone,
  action,
  todos,
  data,
  empty,
}: {
  title: string;
  hint?: string;
  tone?: "amber";
  action?: React.ReactNode;
  todos: Todo[];
  data: TodoPageData;
  empty?: string;
}) {
  return (
    <section className="mt-6" aria-label={title}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className={`text-sm font-semibold ${tone === "amber" ? "text-amber-700 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>
          {title} <span className="font-normal text-slate-500">{todos.length}</span>
        </h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <ul className="glass-inset divide-y divide-slate-200/60 rounded-2xl dark:divide-slate-700/50">
        {todos.map((t) => (
          <TodoItem key={t.id} todo={t} today={data.today} linkOptions={data.linkOptions} />
        ))}
        {todos.length === 0 && empty && <li className="px-4 py-6 text-center text-sm text-slate-500">{empty}</li>}
      </ul>
    </section>
  );
}
