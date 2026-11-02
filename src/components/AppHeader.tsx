import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-6 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6">
      <Link href="/" className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        K8assistant
      </Link>
      <nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Board
        </Link>
        <Link href="/candidates" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Candidates
        </Link>
      </nav>
    </header>
  );
}
