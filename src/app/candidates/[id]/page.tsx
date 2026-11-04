import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidate, getFormOptions } from "@/lib/queries";
import { NewApplicationButton } from "@/components/CreateButtons";
import { LabelChip, StageDot } from "@/components/LabelChip";
import { EngineerAvatar } from "@/components/EngineerAvatar";
import { EngineerColorPicker } from "@/components/EngineerColorPicker";
import { ArchiveCandidateButton, DeleteCandidateButton, RestoreCandidateButton } from "@/components/RemoveButtons";

export async function generateMetadata(props: PageProps<"/candidates/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const candidate = await getCandidate(id);
  return { title: candidate?.name ?? "Not found" };
}

export default async function CandidatePage(props: PageProps<"/candidates/[id]">) {
  const { id } = await props.params;
  const [candidate, options] = await Promise.all([getCandidate(id), getFormOptions()]);
  if (!candidate) notFound(); // renders the 404 page

  const facts = [
    ["Experience", candidate.yearsExperience != null ? `${candidate.yearsExperience} years` : null],
    ["Email", candidate.email],
    ["Phone", candidate.phone],
    ["Source", candidate.source],
  ].filter((f): f is [string, string] => f[1] != null);

  return (
    <main className="mx-auto my-6 w-[calc(100%-2rem)] max-w-4xl rounded-3xl glass-strong px-4 py-6 sm:px-8">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        ← Board
      </Link>

      {candidate.archivedAt && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>
            <strong>Archived.</strong> {candidate.name}&apos;s processes are hidden from the board.
          </span>
          <RestoreCandidateButton candidateId={candidate.id} name={candidate.name} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <EngineerAvatar name={candidate.name} color={candidate.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{candidate.name}</h1>
          {candidate.headline && <p className="text-slate-600 dark:text-slate-400">{candidate.headline}</p>}
        </div>
        <EngineerColorPicker candidateId={candidate.id} color={candidate.color} />
      </div>

      {candidate.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.skills.map((s) => (
            <span
              key={s}
              className="rounded-lg border border-white/80 bg-white/60 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_16rem]">
        {/* Processes: the reason this page exists */}
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Processes ({candidate.applications.length})
            </h2>
            {!candidate.archivedAt && (
              <NewApplicationButton options={options} candidateId={candidate.id} label="+ Add process" />
            )}
          </div>
          <ul className="mt-2 space-y-2">
            {candidate.applications.map((app) => (
              <li
                key={app.id}
                className="glass-inset rounded-2xl p-3"
              >
                <Link href={`/?card=${app.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:underline">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{app.company.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{app.role}</p>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <StageDot color={app.stage.color} />
                    {app.stage.name}
                  </span>
                </Link>
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
              <li className="text-sm text-slate-500">No active processes.</li>
            )}
          </ul>
        </section>

        {/* Profile facts */}
        <aside className="space-y-4 text-sm">
          {facts.length > 0 && (
            <dl className="space-y-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="break-words text-slate-900 dark:text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {candidate.links.length > 0 && (
            <div>
              <p className="text-slate-500">Links</p>
              <ul>
                {candidate.links.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-[#0065a9] hover:underline dark:text-[#7cc4f7]"
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
              <p className="text-slate-500">Context</p>
              <p className="whitespace-pre-line text-slate-900 dark:text-slate-100">{candidate.context}</p>
            </div>
          )}
        </aside>
      </div>

      {/* Removing the engineer */}
      <section className="mt-10 flex flex-wrap items-center gap-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        {!candidate.archivedAt && <ArchiveCandidateButton candidateId={candidate.id} name={candidate.name} />}
        <DeleteCandidateButton candidateId={candidate.id} name={candidate.name} processes={candidate.applications.length} />
      </section>
    </main>
  );
}
