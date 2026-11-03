import type { Metadata } from "next";
import Link from "next/link";
import { getCandidates, getFormOptions } from "@/lib/queries";
import { NewCandidateButton } from "@/components/CreateButtons";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage() {
  const [candidates, options] = await Promise.all([getCandidates(), getFormOptions()]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Candidates</h1>
          <p className="mt-1 text-sm text-zinc-500">{candidates.length} engineers</p>
        </div>
        <NewCandidateButton options={options} />
      </div>

      <ul className="mt-5 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {candidates.map((c) => (
          <li key={c.id}>
            <Link
              href={`/candidates/${c.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                <p className="truncate text-sm text-zinc-500">
                  {[c.headline, c.yearsExperience != null && `${c.yearsExperience} yrs`, c.skills.join(", ")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400">
                {c.activeApplications} {c.activeApplications === 1 ? "process" : "processes"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
