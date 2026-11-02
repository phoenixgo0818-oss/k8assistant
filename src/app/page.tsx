import { getBoard } from "@/lib/queries";
import { StageColumn } from "@/components/StageColumn";

export default async function BoardPage() {
  const columns = await getBoard();
  const total = columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline gap-3 px-4 pt-5 pb-3 sm:px-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Pipeline</h1>
        <p className="text-sm text-zinc-500">{total} active applications</p>
      </div>

      {/* Columns scroll sideways; the page itself doesn't */}
      <div className="flex flex-1 gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
        {columns.map((column) => (
          <StageColumn key={column.id} column={column} />
        ))}
      </div>
    </main>
  );
}
