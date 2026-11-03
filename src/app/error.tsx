"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error); // shows in the browser console; server logs have the details
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Couldn&apos;t load the board</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        The database may be paused or unreachable. Supabase free projects pause after 7 idle days —
        restore it from the Supabase dashboard, then try again.
      </p>
      <button
        onClick={() => retry()}
        className="btn-primary"
      >
        Try again
      </button>
    </main>
  );
}
