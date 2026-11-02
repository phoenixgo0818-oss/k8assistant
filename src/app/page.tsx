export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        K8assistant
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Pipeline board for the engineers I manage — every interview process, one board.
      </p>
      <p className="text-sm text-zinc-500">Phase 1 · Foundation</p>
    </main>
  );
}
