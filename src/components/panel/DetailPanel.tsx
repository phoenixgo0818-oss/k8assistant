import Link from "next/link";
import type { Activity, ApplicationDetail } from "@/lib/queries";
import { LabelPicker, LocalTime, NoteForm, PanelShell, ProfileForm, StagePicker } from "./PanelParts";

const FIELD_NAMES: Record<string, string> = {
  name: "name",
  headline: "headline",
  years_experience: "years of experience",
  email: "email",
  phone: "phone",
  links: "links",
  skills: "skills",
  source: "source",
  context: "context",
};

/** Turn an activity row into a readable sentence */
function describe(a: Activity): React.ReactNode {
  const b = (s: string | null) => <strong className="font-medium text-zinc-800 dark:text-zinc-200">{s || "—"}</strong>;
  switch (a.type) {
    case "candidate_created":
      return <>Profile created</>;
    case "application_created":
      return <>Process started at {b(a.toValue)}</>;
    case "stage_changed":
      return <>Moved {b(a.fromValue)} → {b(a.toValue)}</>;
    case "label_added":
      return <>Label {b(a.toValue)} added</>;
    case "label_removed":
      return <>Label {b(a.toValue)} removed</>;
    case "candidate_updated": {
      const field = FIELD_NAMES[a.field ?? ""] ?? a.field;
      if (a.field === "context") return <>Context edited</>;
      if (!a.fromValue) return <>{field} set to {b(a.toValue)}</>;
      if (!a.toValue) return <>{field} cleared</>;
      return <>{field}: {b(a.fromValue)} → {b(a.toValue)}</>;
    }
    default:
      return <>{a.type}</>;
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</h3>;
}

export function DetailPanel({ detail }: { detail: ApplicationDetail }) {
  const { candidate } = detail;

  return (
    <PanelShell title={`${candidate.name} at ${detail.company.name}`}>
      {/* Header */}
      <div>
        <p className="text-sm text-zinc-500">
          {detail.company.name} · {detail.role}
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{candidate.name}</h2>
        <Link
          href={`/candidates/${candidate.id}`}
          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View all processes{candidate.otherProcesses > 0 && ` (+${candidate.otherProcesses} more)`} →
        </Link>
      </div>

      {/* This process */}
      <div className="space-y-4">
        <StagePicker detail={detail} />
        <LabelPicker detail={detail} />
      </div>

      {/* Notes */}
      <section className="space-y-3">
        <SectionTitle>Notes ({detail.notes.length})</SectionTitle>
        <NoteForm applicationId={detail.id} />
        <ul className="space-y-2">
          {detail.notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
              <p className="whitespace-pre-line text-zinc-900 dark:text-zinc-100">{n.body}</p>
              <p className="mt-1.5 text-xs text-zinc-500">
                <LocalTime iso={n.createdAt} />
                {n.stageName && <> · during <span className="font-medium">{n.stageName}</span></>}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Profile */}
      <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer list-none p-3 text-sm font-medium text-zinc-700 marker:hidden dark:text-zinc-300">
          <span className="mr-1 inline-block transition group-open:rotate-90">›</span>
          Edit profile
          <span className="ml-1 font-normal text-zinc-500">
            (shared by all of {candidate.name.split(" ")[0]}&apos;s processes)
          </span>
        </summary>
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <ProfileForm candidate={candidate} />
        </div>
      </details>

      {/* Activity */}
      <section className="space-y-2">
        <SectionTitle>Activity</SectionTitle>
        <ol className="space-y-2 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {detail.activities.map((a) => (
            <li key={a.id} className="relative text-sm text-zinc-600 dark:text-zinc-400">
              <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <p>
                {describe(a)}
                {a.profileLevel && a.type !== "candidate_created" && (
                  <span className="ml-1 rounded bg-zinc-100 px-1 text-[10px] uppercase text-zinc-500 dark:bg-zinc-800">profile</span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                <LocalTime iso={a.createdAt} />
              </p>
            </li>
          ))}
        </ol>
      </section>
    </PanelShell>
  );
}
