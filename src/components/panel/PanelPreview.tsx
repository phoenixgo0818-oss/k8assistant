"use client";

import { useEffect } from "react";
import type { ApplicationCard } from "@/lib/queries";
import { EngineerAvatar } from "../EngineerAvatar";
import { PanelShell } from "./PanelParts";

/**
 * Shown the instant a card is clicked, using what the board already knows
 * (name, company, role, colour, labels). The real panel replaces it as soon
 * as the server has the rest (notes, history, profile).
 */
export function PanelPreview({ card, onDismiss }: { card: ApplicationCard; onDismiss: () => void }) {
  // Closing (Escape / ✕) or a slow network: never leave the preview stuck open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    const timer = setTimeout(onDismiss, 15000);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const bar = "animate-pulse rounded-lg bg-sky-100/80 dark:bg-slate-800/70";
  return (
    <div className="contents [&>aside]:z-[25]" aria-busy="true" onClickCapture={(e) => (e.target as HTMLElement).closest('a[href="/"]') && onDismiss()}>
      <PanelShell title={`${card.candidate.name} at ${card.company.name} (loading)`}>
        <div>
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">{card.company.name}</span> · {card.role}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <EngineerAvatar name={card.candidate.name} color={card.candidate.color} size="lg" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{card.candidate.name}</h2>
          </div>
        </div>
        <div className="space-y-3">
          <div className={`${bar} h-4 w-16`} />
          <div className={`${bar} h-10`} />
          <div className={`${bar} h-4 w-20`} />
          <div className={`${bar} h-7 w-3/4`} />
          <div className={`${bar} h-24`} />
          <div className={`${bar} h-16`} />
        </div>
      </PanelShell>
    </div>
  );
}
