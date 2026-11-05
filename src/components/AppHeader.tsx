import Link from "next/link";
import { Suspense } from "react";
import { ActiveNav, NavLinks } from "./NavLinks";

// The header is static (prerendered). Only the "which tab is active" part
// reads the URL, so it sits in its own <Suspense>: until it resolves, the
// same links render without a highlight.
export function AppHeader() {
  return (
    <header className="glass-strong sticky top-0 z-30 flex h-14 items-center gap-4 rounded-none border-x-0 border-t-0 px-4 sm:gap-8 sm:px-6">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span aria-hidden className="brand-gradient flex size-7 items-center justify-center rounded-lg text-sm font-bold text-white shadow-md shadow-[#0065a9]/40">
          K8
        </span>
        <span className="brand-text hidden text-lg sm:inline">K8assistant</span>
      </Link>
      <Suspense fallback={<NavLinks pathname={null} />}>
        <ActiveNav />
      </Suspense>
    </header>
  );
}
