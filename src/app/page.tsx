import { Suspense } from "react";
import { getApplicationDetail, getBoard, getFormOptions } from "@/lib/queries";
import { Board } from "@/components/Board";
import { NewApplicationButton, NewCandidateButton } from "@/components/CreateButtons";
import { DetailPanel } from "@/components/panel/DetailPanel";
import { UpcomingPanel, UpcomingPanelSkeleton } from "@/components/todos/UpcomingPanel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BoardPage(props: PageProps<"/">) {
  // ?card=<id> in the URL = which card's detail panel is open
  const { card } = await props.searchParams;
  const cardId = typeof card === "string" && UUID.test(card) ? card : undefined;

  // Server Component: fetch the board on the server (in parallel) and hand
  // plain data to the interactive (client) Board.
  const [columns, options] = await Promise.all([getBoard(), getFormOptions()]);
  const total = columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    // The page fits the window (minus the 3.5rem header): the board takes the
    // top ~70% and scrolls inside itself, the Upcoming panel the bottom 30%.
    <main className="flex h-[calc(100dvh-3.5rem)] min-h-[32rem] flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 pt-5 pb-3 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-on-backdrop drop-shadow-sm">Pipeline</h1>
        <p className="text-sm text-on-backdrop-muted">{total} active applications</p>
        <div className="ml-auto flex gap-2">
          <NewApplicationButton options={options} />
          <NewCandidateButton options={options} />
        </div>
      </div>

      <div className="flex min-h-0 flex-[7] flex-col">
        <Board columns={columns} selectedId={cardId} labels={options.labels} companies={options.companies} />
      </div>

      {/* Streams in on its own: the board never waits for the events */}
      <div className="flex min-h-40 flex-[3] flex-col">
        <Suspense fallback={<UpcomingPanelSkeleton />}>
          <UpcomingPanel />
        </Suspense>
      </div>

      {/* The panel streams in separately: the board never waits for it.
          Meanwhile the board shows an instant preview (PanelPreview). */}
      {cardId && (
        <Suspense key={cardId} fallback={null}>
          <CardPanel id={cardId} />
        </Suspense>
      )}
    </main>
  );
}

async function CardPanel({ id }: { id: string }) {
  const detail = await getApplicationDetail(id);
  // An unknown or stale ?card= id simply shows no panel
  return detail ? <DetailPanel detail={detail} /> : null;
}
