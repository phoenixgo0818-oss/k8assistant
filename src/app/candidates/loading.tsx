// Suspense boundary + skeleton for /candidates and /candidates/[id]
export default function CandidatesLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-5 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/50 dark:bg-slate-800/50" />
        ))}
      </div>
    </main>
  );
}
