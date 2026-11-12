import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { ActiveNav, NavLinks } from "./NavLinks";

// The header is static (prerendered). Only the "which tab is active" part
// reads the URL, so it sits in its own <Suspense>: until it resolves, the
// same links render without a highlight. The user menu reads the session
// cookie, so it streams in behind its own <Suspense> too.
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
      <Suspense fallback={null}>
        <UserMenu />
      </Suspense>
    </header>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null; // signed out (e.g. on /login): nothing to show
  return (
    <form action={signOut} className="ml-auto flex items-center gap-3">
      <span className="hidden max-w-48 truncate text-sm text-slate-600 md:inline dark:text-slate-400" title={user.email}>
        {user.email}
      </span>
      <button type="submit" className="btn-secondary">
        Sign out
      </button>
    </form>
  );
}
