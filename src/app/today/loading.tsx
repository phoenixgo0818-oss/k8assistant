// Suspense boundary + skeleton for /today (the page reads the database)
export default function TodayLoading() {
  return (
    <main className="mx-auto my-6 w-[calc(100%-2rem)] max-w-4xl rounded-3xl glass-strong px-4 py-6 sm:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-5 h-16 animate-pulse rounded-2xl bg-white/50 dark:bg-slate-800/50" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/50 dark:bg-slate-800/50" />
        ))}
      </div>
    </main>
  );
}
