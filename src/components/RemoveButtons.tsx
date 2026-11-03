"use client";

// Thin wrappers so Server Components (pages) can render these without passing
// functions across the server → client boundary.

import { deleteApplication, deleteCandidate, deleteCompany, setCandidateArchived } from "@/app/actions";
import { ConfirmAction } from "./ConfirmAction";

const linkDanger = "text-sm font-medium text-red-600 hover:underline dark:text-red-400";
const linkNeutral = "text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400";

export function ArchiveCandidateButton({ candidateId, name, redirectTo }: { candidateId: string; name: string; redirectTo?: string }) {
  return (
    <ConfirmAction
      label="Archive engineer"
      buttonClassName={linkNeutral}
      tone="neutral"
      title={`Archive ${name}?`}
      message={
        <>
          <p>All of {name}&apos;s cards disappear from the board and lists. Nothing is deleted.</p>
          <p className="mt-2">You can restore them any time from <strong>Candidates → Archived</strong>.</p>
        </>
      }
      confirmLabel="Archive"
      action={() => setCandidateArchived({ candidateId, archived: true })}
      redirectTo={redirectTo}
    />
  );
}

export function RestoreCandidateButton({ candidateId, name }: { candidateId: string; name: string }) {
  return (
    <ConfirmAction
      label="Restore"
      buttonClassName="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
      tone="neutral"
      title={`Restore ${name}?`}
      message={<p>{name} and all their processes come back on the board where they were.</p>}
      confirmLabel="Restore"
      action={() => setCandidateArchived({ candidateId, archived: false })}
    />
  );
}

export function DeleteCandidateButton({ candidateId, name, processes }: { candidateId: string; name: string; processes: number }) {
  return (
    <ConfirmAction
      label="Delete permanently…"
      buttonClassName={linkDanger}
      title={`Delete ${name} permanently?`}
      message={
        <>
          <p>
            This deletes {name}&apos;s profile{processes > 0 && <> and <strong>{processes} process{processes === 1 ? "" : "es"}</strong></>}, with
            all notes and history. <strong>This can&apos;t be undone.</strong>
          </p>
          <p className="mt-2 text-zinc-500">Just want them off the board? Use Archive instead.</p>
        </>
      }
      confirmLabel="Delete permanently"
      action={() => deleteCandidate({ candidateId })}
      redirectTo="/candidates"
    />
  );
}

export function DeleteApplicationButton({
  applicationId,
  what,
  redirectTo,
}: {
  applicationId: string;
  /** e.g. "Alex Kim at Cobalt Pay" */
  what: string;
  redirectTo?: string;
}) {
  return (
    <ConfirmAction
      label="Remove process…"
      buttonClassName={linkDanger}
      title="Remove this process?"
      message={
        <p>
          Removes <strong>{what}</strong> with its notes and labels. The engineer&apos;s profile and other processes
          stay. <strong>This can&apos;t be undone.</strong>
        </p>
      }
      confirmLabel="Remove process"
      action={() => deleteApplication({ applicationId })}
      redirectTo={redirectTo}
    />
  );
}

export function DeleteCompanyButton({ companyId, name, processes }: { companyId: string; name: string; processes: number }) {
  return (
    <ConfirmAction
      label="Delete company…"
      buttonClassName={linkDanger}
      title={`Delete ${name}?`}
      message={
        processes > 0 ? (
          <p>
            {name} still has <strong>{processes} process{processes === 1 ? "" : "es"}</strong>. Remove or move them first.
          </p>
        ) : (
          <p>Deletes {name} and its notes. This can&apos;t be undone.</p>
        )
      }
      confirmLabel="Delete company"
      action={() => deleteCompany({ companyId })}
      redirectTo="/companies"
    />
  );
}
