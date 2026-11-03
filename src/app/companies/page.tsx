import type { Metadata } from "next";
import Link from "next/link";
import { getCompanies } from "@/lib/queries";
import { NewCompanyButton } from "@/components/CompanyForms";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Companies</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {companies.length} companies · new ones are also created when you type a new name in “+ New application”
          </p>
        </div>
        <NewCompanyButton />
      </div>

      <ul className="mt-5 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {companies.map((c) => (
          <li key={c.id}>
            <Link href={`/companies/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                {c.website && <p className="truncate text-sm text-zinc-500">{c.website.replace(/^https?:\/\//, "")}</p>}
              </div>
              <span className="shrink-0 text-right text-sm text-zinc-600 dark:text-zinc-400">
                {c.processes} {c.processes === 1 ? "process" : "processes"}
                <span className="block text-xs text-zinc-500">
                  {c.engineers} {c.engineers === 1 ? "engineer" : "engineers"}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {companies.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">No companies yet.</li>}
      </ul>
    </main>
  );
}
