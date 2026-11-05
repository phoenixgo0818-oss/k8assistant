import Link from "next/link";
import { memo } from "react";
import type { ApplicationCard as Card } from "@/lib/queries";
import { EngineerAvatar } from "./EngineerAvatar";
import { LabelChip } from "./LabelChip";

/**
 * One card = one application (engineer × company × role).
 * Clicking opens the detail panel: the URL becomes /?card=<id>, so it can be
 * shared or bookmarked, and the browser's Back button closes it.
 *
 * Compact layout for narrow columns: name, company and role each get a line,
 * so the card grows in height instead of width.
 * The engineer's colour = stripe + avatar + soft tint over the material surface.
 * No backdrop blur here on purpose: 25+ blurred cards are expensive to paint.
 */
export const ApplicationCard = memo(function ApplicationCard({
  card,
  selected = false,
  onOpen,
}: {
  card: Card;
  selected?: boolean;
  /** Called on click, before navigation, so the panel can open instantly */
  onOpen?: (card: Card) => void;
}) {
  const color = card.candidate.color;
  return (
    <Link
      href={`/?card=${card.id}`}
      scroll={false}
      prefetch={false} // 25 cards × prefetch = 25 server renders; open on click instead
      onClick={(e) => {
        // Skip when the click ended a drag (default prevented) or opens a new tab
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        onOpen?.(card);
      }}
      aria-current={selected ? "true" : undefined}
      className={`card-material relative block overflow-hidden rounded-xl px-2.5 py-2 pl-3 focus-visible:outline-2 focus-visible:outline-white ${
        selected ? "ring-2 ring-white shadow-lg" : ""
      }`}
      style={{ backgroundImage: `linear-gradient(140deg, ${color}2e 0%, ${color}0d 50%, transparent 80%), var(--card-surface)` }}
    >
      {/* colour stripe */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: color }} />

      <div className="flex items-center gap-1.5">
        <EngineerAvatar name={card.candidate.name} color={color} size="sm" />
        <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-semibold text-slate-900 dark:text-slate-50">
          {card.candidate.name}
        </p>
      </div>
      <p className="mt-1.5 truncate text-xs font-medium text-slate-800 dark:text-slate-200" title={card.company.name}>
        {card.company.name}
      </p>
      <p className="line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">{card.role}</p>

      {(card.labels.length > 0 || card.noteCount > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {card.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          {card.noteCount > 0 && (
            <span
              className="relative ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-500"
              title={`${card.noteCount} note${card.noteCount === 1 ? "" : "s"}`}
            >
              <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
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
});
