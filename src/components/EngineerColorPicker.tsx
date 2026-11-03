"use client";

import { useState, useTransition } from "react";
import { setCandidateColor } from "@/app/actions";
import { ENGINEER_COLORS } from "@/lib/constants";

/** One click changes the engineer's colour on every card they have */
export function EngineerColorPicker({ candidateId, color }: { candidateId: string; color: string }) {
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [prevColor, setPrevColor] = useState(color);
  if (color !== prevColor) {
    setPrevColor(color);
    setOptimistic(null); // server confirmed (or reverted)
  }
  const current = optimistic ?? color;
  const [, startTransition] = useTransition();

  return (
    <div role="radiogroup" aria-label="Engineer colour" className="flex flex-wrap gap-1.5">
      {ENGINEER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={current === c}
          aria-label={`Colour ${c}`}
          title="Use this colour for all of this engineer's cards"
          onClick={() => {
            if (c === current) return;
            setOptimistic(c);
            startTransition(async () => {
              const r = await setCandidateColor({ candidateId, color: c });
              if (!r.ok) setOptimistic(null);
            });
          }}
          className={`size-5 rounded-full transition hover:scale-110 ${
            current === c ? "ring-2 ring-slate-900/70 ring-offset-2 ring-offset-white dark:ring-white/80 dark:ring-offset-slate-900" : ""
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
