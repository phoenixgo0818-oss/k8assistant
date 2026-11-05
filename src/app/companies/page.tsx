import type { Metadata } from "next";
import Link from "next/link";
import { getCompanies } from "@/lib/queries";
import { NewCompanyButton } from "@/components/CompanyForms";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <main className="mx-auto my-6 w-[calc(100%-2rem)] max-w-4xl rounded-3xl glass-strong px-4 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Companies</h1>
          <p className="mt-1 text-sm text-slate-500">
            {companies.length} companies · new ones are also created when you type a new name in “+ New application”
          </p>
        </div>
        <NewCompanyButton />
      </div>

      <ul className="glass-inset mt-5 divide-y divide-slate-200/60 overflow-hidden rounded-2xl dark:divide-slate-700/50">
        {companies.map((c) => (
          <li key={c.id}>
            <Link href={`/companies/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-white/80 dark:hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                {c.website && <p className="truncate text-sm text-slate-500">{c.website.replace(/^https?:\/\//, "")}</p>}
              </div>
              <span className="shrink-0 text-right text-sm text-slate-600 dark:text-slate-400">
                {c.processes} {c.processes === 1 ? "process" : "processes"}
                <span className="block text-xs text-slate-500">
                  {c.engineers} {c.engineers === 1 ? "engineer" : "engineers"}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {companies.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No companies yet.</li>}
      </ul>
    </main>
  );
}
