import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidate } from "@/lib/queries";
import { LabelChip, StageDot } from "@/components/LabelChip";

export async function generateMetadata(props: PageProps<"/candidates/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const candidate = await getCandidate(id);
  return { title: candidate?.name ?? "Not found" };
}

export default async function CandidatePage(props: PageProps<"/candidates/[id]">) {
  const { id } = await props.params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound(); // renders the 404 page

  const facts = [
    ["Experience", candidate.yearsExperience != null ? `${candidate.yearsExperience} years` : null],
    ["Email", candidate.email],
    ["Phone", candidate.phone],
    ["Source", candidate.source],
  ].filter((f): f is [string, string] => f[1] != null);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Board
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{candidate.name}</h1>
      {candidate.headline && <p className="text-zinc-600 dark:text-zinc-400">{candidate.headline}</p>}

      {candidate.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.skills.map((s) => (
            <span
              key={s}
              className="rounded-md bg-zinc-200/70 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_16rem]">
        {/* Processes: the reason this page exists */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Processes ({candidate.applications.length})
          </h2>
          <ul className="mt-2 space-y-2">
            {candidate.applications.map((app) => (
              <li
                key={app.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{app.company.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{app.role}</p>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    <StageDot color={app.stage.color} />
                    {app.stage.name}
                  </span>
                </div>
                {app.labels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.labels.map((l) => (
                      <LabelChip key={l.id} label={l} />
                    ))}
                  </div>
                )}
              </li>
            ))}
            {candidate.applications.length === 0 && (
              <li className="text-sm text-zinc-500">No active processes.</li>
            )}
          </ul>
        </section>

        {/* Profile facts */}
        <aside className="space-y-4 text-sm">
          {facts.length > 0 && (
            <dl className="space-y-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="break-words text-zinc-900 dark:text-zinc-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {candidate.links.length > 0 && (
            <div>
              <p className="text-zinc-500">Links</p>
              <ul>
                {candidate.links.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {url.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {candidate.context && (
            <div>
              <p className="text-zinc-500">Context</p>
              <p className="whitespace-pre-line text-zinc-900 dark:text-zinc-100">{candidate.context}</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
