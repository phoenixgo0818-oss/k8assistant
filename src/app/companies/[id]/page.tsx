import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/queries";
import { EditCompanyForm } from "@/components/CompanyForms";
import { StageDot } from "@/components/LabelChip";
import { EngineerAvatar } from "@/components/EngineerAvatar";
import { DeleteCompanyButton } from "@/components/RemoveButtons";

export async function generateMetadata(props: PageProps<"/companies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const company = await getCompany(id);
  return { title: company?.name ?? "Not found" };
}

export default async function CompanyPage(props: PageProps<"/companies/[id]">) {
  const { id } = await props.params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/companies" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        ← Companies
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">{company.name}</h1>
      {company.website && (
        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-700 hover:underline dark:text-sky-400">
          {company.website.replace(/^https?:\/\//, "")}
        </a>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_18rem]">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Engineers in process here ({company.processes.length})
          </h2>
          <ul className="mt-2 space-y-2">
            {company.processes.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.candidate.archived ? `/candidates/${p.candidate.id}` : `/?card=${p.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 glass rounded-2xl p-3 transition hover:bg-white/70 dark:hover:bg-slate-800/60"
                >
                  <EngineerAvatar name={p.candidate.name} color={p.candidate.color} size="sm" />
                  <span className="font-medium text-slate-900 dark:text-slate-100">{p.candidate.name}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{p.role}</span>
                  {p.candidate.archived && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">archived</span>}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <StageDot color={p.stage.color} />
                    {p.stage.name}
                  </span>
                </Link>
              </li>
            ))}
            {company.processes.length === 0 && (
              <li className="text-sm text-slate-500">
                No processes yet. Add one with “+ New application” on the board.
              </li>
            )}
          </ul>
        </section>

        <aside>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Details</h2>
          <EditCompanyForm company={company} />
          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <DeleteCompanyButton companyId={company.id} name={company.name} processes={company.processes.length} />
          </div>
        </aside>
      </div>
    </main>
  );
}
