import type { BoardColumn } from "@/lib/queries";
import { ApplicationCard } from "./ApplicationCard";
import { StageDot } from "./LabelChip";

export function StageColumn({ column }: { column: BoardColumn }) {
  return (
    <section
      aria-label={`${column.name}, ${column.cards.length} cards`}
      className={`flex w-72 shrink-0 flex-col rounded-xl p-2 ${
        column.isFinal ? "bg-zinc-100/60 dark:bg-zinc-900/40" : "bg-zinc-100 dark:bg-zinc-900/70"
      }`}
    >
      <header className="flex items-center gap-2 px-2 py-1.5">
        <StageDot color={column.color} />
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{column.name}</h2>
        <span className="ml-auto rounded-full bg-zinc-200 px-2 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {column.cards.length}
        </span>
      </header>

      <div className="flex flex-col gap-2 overflow-y-auto p-1">
        {column.cards.map((card) => (
          <ApplicationCard key={card.id} card={card} />
        ))}
        {column.cards.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">
            No applications
          </p>
        )}
      </div>
    </section>
  );
}
