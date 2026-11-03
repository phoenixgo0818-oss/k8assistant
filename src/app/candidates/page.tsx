import type { Metadata } from "next";
import Link from "next/link";
import { getArchivedCandidates, getCandidates, getFormOptions } from "@/lib/queries";
import { NewCandidateButton } from "@/components/CreateButtons";
import { EngineerAvatar } from "@/components/EngineerAvatar";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage() {
  const [candidates, archived, options] = await Promise.all([getCandidates(), getArchivedCandidates(), getFormOptions()]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">{candidates.length} engineers</p>
        </div>
        <NewCandidateButton options={options} />
      </div>

      <ul className="glass mt-5 divide-y divide-slate-200/60 overflow-hidden rounded-2xl dark:divide-slate-700/50">
        {candidates.map((c) => (
          <li key={c.id}>
            <Link
              href={`/candidates/${c.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-white/60 dark:hover:bg-slate-800/50"
            >
              <EngineerAvatar name={c.name} color={c.color} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                <p className="truncate text-sm text-slate-500">
                  {[c.headline, c.yearsExperience != null && `${c.yearsExperience} yrs`, c.skills.join(", ")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-sm text-slate-600 dark:text-slate-400">
                {c.activeApplications} {c.activeApplications === 1 ? "process" : "processes"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
            Archived ({archived.length})
          </summary>
          <ul className="glass mt-2 divide-y divide-slate-200/60 overflow-hidden rounded-2xl dark:divide-slate-700/50">
            {archived.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/candidates/${c.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
                >
                  <span className="flex items-center gap-2.5">
                    <EngineerAvatar name={c.name} color={c.color} size="sm" />
                    {c.name}
                  </span>
                  <span className="text-xs text-slate-400">Open to restore or delete →</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
