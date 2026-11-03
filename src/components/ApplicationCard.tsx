import Link from "next/link";
import type { ApplicationCard as Card } from "@/lib/queries";
import { LabelChip } from "./LabelChip";

/**
 * One card = one application (engineer × company × role).
 * Clicking opens the detail panel: the URL becomes /?card=<id>, so it can be
 * shared or bookmarked, and the browser's Back button closes it.
 */
export function ApplicationCard({ card, selected = false }: { card: Card; selected?: boolean }) {
  return (
    <Link
      href={`/?card=${card.id}`}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`block rounded-lg border bg-white p-3 shadow-sm transition hover:shadow focus-visible:outline-2 focus-visible:outline-indigo-500 dark:bg-zinc-900 ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-500/30"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
      }`}
    >
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{card.candidate.name}</p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{card.company.name}</span>
        {" · "}
        {card.role}
      </p>
      {(card.labels.length > 0 || card.noteCount > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {card.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          {card.noteCount > 0 && (
            <span
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500"
              title={`${card.noteCount} note${card.noteCount === 1 ? "" : "s"}`}
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" strokeLinejoin="round" />
              </svg>
              {card.noteCount}
              <span className="sr-only">notes</span>
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
