import Link from "next/link";
import type { ApplicationCard as Card } from "@/lib/queries";
import { LabelChip } from "./LabelChip";

/**
 * One card = one application (engineer × company × role).
 * For now it links to the engineer's page; Step 2.4 opens a side panel instead.
 */
export function ApplicationCard({ card }: { card: Card }) {
  return (
    <Link
      href={`/candidates/${card.candidate.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-zinc-300 hover:shadow focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{card.candidate.name}</p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{card.company.name}</span>
        {" · "}
        {card.role}
      </p>
      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
    </Link>
  );
}
