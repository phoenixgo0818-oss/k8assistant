import { getBoard, getFormOptions } from "@/lib/queries";
import { Board } from "@/components/Board";
import { NewApplicationButton, NewCandidateButton } from "@/components/CreateButtons";

export default async function BoardPage() {
  // Server Component: fetch on the server, hand plain data to the
  // interactive (client) Board.
  const [columns, options] = await Promise.all([getBoard(), getFormOptions()]);
  const total = columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-5 pb-3 sm:px-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Pipeline</h1>
        <p className="text-sm text-zinc-500">{total} active applications</p>
        <div className="ml-auto flex gap-2">
          <NewApplicationButton options={options} />
          <NewCandidateButton options={options} />
        </div>
      </div>

      <Board columns={columns} />
    </main>
  );
}
