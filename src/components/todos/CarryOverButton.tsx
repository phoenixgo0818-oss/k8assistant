"use client";

import { useTransition } from "react";
import { carryOverTodos } from "@/app/actions";

/** "Move all to today": rolls every open to-do from an earlier day forward. */
export function CarryOverButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await carryOverTodos()))}
      className="btn-secondary px-3 py-1 text-xs"
    >
      {pending ? "Moving…" : `Move all ${count} to today`}
    </button>
  );
}
