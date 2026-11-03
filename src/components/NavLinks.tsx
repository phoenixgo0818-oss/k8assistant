"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/candidates", label: "Candidates" },
  { href: "/companies", label: "Companies" },
];

export function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) => pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav className="flex gap-1 text-sm">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${
            isActive(item.href)
              ? "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300"
              : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
