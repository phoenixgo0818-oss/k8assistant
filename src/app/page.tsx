import { getApplicationDetail, getBoard, getFormOptions } from "@/lib/queries";
import { Board } from "@/components/Board";
import { NewApplicationButton, NewCandidateButton } from "@/components/CreateButtons";
import { DetailPanel } from "@/components/panel/DetailPanel";

export default async function BoardPage(props: PageProps<"/">) {
  // ?card=<id> in the URL = which card's detail panel is open
  const { card } = await props.searchParams;
  const cardId = typeof card === "string" ? card : undefined;

  // Server Component: fetch on the server (in parallel), hand plain data to
  // the interactive (client) Board and panel.
  const [columns, options, detail] = await Promise.all([
    getBoard(),
    getFormOptions(),
    cardId ? getApplicationDetail(cardId) : Promise.resolve(null),
  ]);
  const total = columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-5 pb-3 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Pipeline</h1>
        <p className="text-sm text-slate-500">{total} active applications</p>
        <div className="ml-auto flex gap-2">
          <NewApplicationButton options={options} />
          <NewCandidateButton options={options} />
        </div>
      </div>

      <Board columns={columns} selectedId={detail?.id} />

      {/* An unknown or stale ?card= id simply shows no panel */}
      {detail && <DetailPanel detail={detail} />}
    </main>
  );
}
