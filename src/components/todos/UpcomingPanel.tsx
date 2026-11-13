import { getUpcomingEvents } from "@/lib/queries";
import { isLate } from "@/lib/todos";
import { CarryOverButton } from "./CarryOverButton";
import { EventRow } from "./EventRow";
import { AddEventButton } from "./TodoForms";

/**
 * "Upcoming" under the board: open events in time order. Late ones (an
 * earlier day, not ticked off) come first, so nothing slips out of sight.
 * A Server Component: it reads the database itself, inside its own
 * <Suspense> on the board page, so the board never waits for it.
 */
export async function UpcomingPanel() {
  const { today, events, linkOptions } = await getUpcomingEvents();
  const late = events.filter((e) => isLate(e, today)).length;

  return (
    <PanelShell
      title={
        <>
          Upcoming <span className="font-normal text-slate-500">{events.length}</span>
          {late > 0 && <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">{late} late</span>}
        </>
      }
      actions={
        <>
          {late > 0 && <CarryOverButton count={late} />}
          <AddEventButton today={today} linkOptions={linkOptions} />
        </>
      }
    >
      <ul className="divide-y divide-slate-200/60 dark:divide-slate-700/50">
        {events.map((e) => (
          <EventRow key={e.id} todo={e} today={today} linkOptions={linkOptions} />
        ))}
        {events.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">Nothing coming up. Add interviews, calls and follow-ups with “+ Add event”.</li>
        )}
      </ul>
    </PanelShell>
  );
}

/** The frame, shared with the loading skeleton so nothing jumps when data arrives. */
export function PanelShell({ title, actions, children }: { title: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label="Upcoming events" className="glass-strong mx-4 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:mx-6">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200/60 px-3 py-2 dark:border-slate-700/50">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      {/* Only the list scrolls; the header stays put */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

export function UpcomingPanelSkeleton() {
  return (
    <PanelShell title="Upcoming">
      <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading events">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-lg bg-white/50 dark:bg-slate-800/50" />
        ))}
      </div>
    </PanelShell>
  );
}
