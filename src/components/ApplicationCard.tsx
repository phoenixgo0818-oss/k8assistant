import Link from "next/link";
import type { ApplicationCard as Card } from "@/lib/queries";
import { EngineerAvatar } from "./EngineerAvatar";
import { LabelChip } from "./LabelChip";

/**
 * One card = one application (engineer × company × role).
 * Clicking opens the detail panel: the URL becomes /?card=<id>, so it can be
 * shared or bookmarked, and the browser's Back button closes it.
 *
 * The engineer's colour shows as a stripe, an avatar and a soft tint, so all
 * of one person's processes are easy to spot across the board.
 */
export function ApplicationCard({ card, selected = false }: { card: Card; selected?: boolean }) {
  const color = card.candidate.color;
  return (
    <Link
      href={`/?card=${card.id}`}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`relative block overflow-hidden rounded-xl border p-3 pl-4 backdrop-blur-md transition hover:-translate-y-px hover:shadow-lg focus-visible:outline-2 focus-visible:outline-sky-500 ${
        selected
          ? "border-sky-400 shadow-lg ring-2 ring-sky-400/40"
          : "border-white/80 shadow-sm shadow-blue-900/5 dark:border-slate-700/60"
      }`}
      style={{
        // tint: the engineer's colour fading into the frosted card
        backgroundImage: `linear-gradient(135deg, ${color}24 0%, ${color}0a 45%, transparent 75%)`,
        backgroundColor: "var(--card-bg)",
      }}
    >
      {/* colour stripe */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />

      <div className="flex items-start gap-2.5">
        <EngineerAvatar name={card.candidate.name} color={color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-50">{card.candidate.name}</p>
          <p className="text-sm leading-snug text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{card.company.name}</span>
            {" · "}
            {card.role}
          </p>
        </div>
      </div>

      {(card.labels.length > 0 || card.noteCount > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {card.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          {card.noteCount > 0 && (
            <span
              className="relative ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500"
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
