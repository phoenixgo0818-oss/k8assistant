import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth-rules";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

// The card is static (prerendered). Only the form reads the URL (?next=),
// so it streams in behind its own <Suspense>.
export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="glass-strong flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl px-6 py-10 text-center">
        <span aria-hidden className="brand-gradient flex size-12 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md shadow-[#0065a9]/40">
          K8
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Sign in to K8assistant</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Accounts are created by the admin.</p>
        </div>
        <Suspense fallback={<LoginForm next="/" />}>
          <FormWithNext searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function FormWithNext({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(typeof next === "string" ? next : null)} />;
}
