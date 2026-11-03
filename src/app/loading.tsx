// Shown instantly while the board's data streams in.
// With cacheComponents, this file is also the <Suspense> boundary that lets
// the page read request-time data (the database).
export default function BoardLoading() {
  return (
    <main className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading board">
      <div className="px-4 pt-5 pb-3 sm:px-6">
        <div className="h-7 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="flex gap-3 overflow-hidden px-4 sm:px-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-[17.5rem] shrink-0 flex-col gap-2 glass rounded-2xl p-3">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            {Array.from({ length: 3 - (i % 2) }, (_, j) => (
              <div key={j} className="h-16 animate-pulse rounded-xl bg-white/60 dark:bg-slate-800/50" />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
