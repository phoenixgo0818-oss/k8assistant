import Link from "next/link";
import { EngineerAvatar } from "../EngineerAvatar";
import { EngineerColorPicker } from "../EngineerColorPicker";
import type { Activity, ApplicationDetail } from "@/lib/queries";
import { ArchiveCandidateButton, DeleteApplicationButton } from "../RemoveButtons";
import { LabelPicker, LocalTime, NoteForm, NoteItem, PanelShell, ProfileForm, StagePicker } from "./PanelParts";

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
  const b = (s: string | null) => <strong className="font-medium text-slate-800 dark:text-slate-200">{s || "—"}</strong>;
  switch (a.type) {
    case "candidate_created":
      return <>Profile created</>;
    case "application_created":
      return <>Process started at {b(a.toValue)}</>;
    case "stage_changed":
      return <>Moved {b(a.fromValue)} → {b(a.toValue)}</>;
    case "candidate_archived":
      return <>Engineer archived</>;
    case "candidate_restored":
      return <>Engineer restored</>;
    case "application_deleted":
      return <>Process removed: {b(a.fromValue)}</>;
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
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>;
}

export function DetailPanel({ detail }: { detail: ApplicationDetail }) {
  const { candidate } = detail;

  return (
    <PanelShell title={`${candidate.name} at ${detail.company.name}`}>
      {/* Header */}
      <div>
        <p className="text-sm text-slate-500">
          <Link href={`/companies/${detail.company.id}`} className="font-medium text-slate-700 hover:underline dark:text-slate-300">
            {detail.company.name}
          </Link>{" "}
          · {detail.role}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <EngineerAvatar name={candidate.name} color={candidate.color} size="lg" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{candidate.name}</h2>
        </div>
        <div className="mt-3">
          <EngineerColorPicker candidateId={candidate.id} color={candidate.color} />
        </div>
        <Link
          href={`/candidates/${candidate.id}`}
          className="mt-2 inline-block text-xs font-medium text-[#0065a9] hover:underline dark:text-[#7cc4f7]"
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
            <NoteItem key={n.id} note={n} />
          ))}
        </ul>
      </section>

      {/* Profile */}
      <details className="group rounded-lg border border-slate-200 dark:border-slate-800">
        <summary className="cursor-pointer list-none p-3 text-sm font-medium text-slate-700 marker:hidden dark:text-slate-300">
          <span className="mr-1 inline-block transition group-open:rotate-90">›</span>
          Edit profile
          <span className="ml-1 font-normal text-slate-500">
            (shared by all of {candidate.name.split(" ")[0]}&apos;s processes)
          </span>
        </summary>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <ProfileForm candidate={candidate} />
        </div>
      </details>

      {/* Activity */}
      <section className="space-y-2">
        <SectionTitle>Activity</SectionTitle>
        <ol className="space-y-2 border-l border-slate-200 pl-4 dark:border-slate-800">
          {detail.activities.map((a) => (
            <li key={a.id} className="relative text-sm text-slate-600 dark:text-slate-400">
              <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
              <p>
                {describe(a)}
                {a.profileLevel && a.type !== "candidate_created" && (
                  <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-500 dark:bg-slate-800">profile</span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                <LocalTime iso={a.createdAt} />
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Removing */}
      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <DeleteApplicationButton applicationId={detail.id} what={`${candidate.name} at ${detail.company.name}`} redirectTo="/" />
        <ArchiveCandidateButton candidateId={candidate.id} name={candidate.name} redirectTo="/" />
      </section>
    </PanelShell>
  );
}
