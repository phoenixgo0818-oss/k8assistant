"use server";

// Server Actions: functions that run on the server but can be called from
// forms and buttons in the browser. Next.js turns each export into an HTTP
// endpoint, so treat every argument as untrusted input and validate it.

import { refresh } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/supabase";
import { LABEL_COLORS } from "@/lib/constants";

export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Changes on every success so the client knows to close/reset the form */
  submittedAt?: number;
};

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const uuid = z.uuid();

const newApplicationFields = {
  company: z.string().trim().min(1, "Company is required").max(120),
  role: z.string().trim().min(1, "Role is required").max(120),
  stageId: uuid,
};

const candidateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  headline: optionalText(120),
  email: z
    .union([z.literal(""), z.email("Not a valid email")])
    .optional()
    .transform((v) => v || undefined),
  skills: z
    .string()
    .optional()
    .transform((v) =>
      [...new Set((v ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 30),
    ),
  // Optional first application: all-or-nothing, checked below
  company: optionalText(120),
  role: optionalText(120),
  stageId: uuid.optional(),
});

const applicationSchema = z.object({ candidateId: uuid, ...newApplicationFields });

const moveSchema = z.object({
  applicationId: uuid,
  stageId: uuid,
  prevId: uuid.nullable(), // card that ends up directly above (null = top)
  nextId: uuid.nullable(), // card that ends up directly below (null = bottom)
});

function formValues(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
}

function invalid(error: z.ZodError): FormState {
  return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: z.flattenError(error).fieldErrors };
}

// ---------------------------------------------------------------------------
// Ranking helpers (fractional indexing)
// ---------------------------------------------------------------------------
async function lastRankInStage(stageId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("applications")
    .select("rank")
    .eq("stage_id", stageId)
    .order("rank", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.rank ?? null;
}

async function rankAtEnd(stageId: string): Promise<string> {
  return generateKeyBetween(await lastRankInStage(stageId), null);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
async function insertApplication(input: {
  candidateId: string;
  company: string;
  role: string;
  stageId: string;
}) {
  const { error } = await db().rpc("create_application", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_candidate_id: input.candidateId,
    p_company_name: input.company,
    p_role: input.role,
    p_stage_id: input.stageId,
    p_rank: await rankAtEnd(input.stageId), // new cards go to the bottom
  });
  if (error) throw new Error(error.message);
}

export async function createCandidate(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = candidateSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  // First application is optional, but if started it must be complete
  const wantsApplication = Boolean(v.company || v.role);
  if (wantsApplication && (!v.company || !v.role || !v.stageId)) {
    return {
      ok: false,
      message: "To add a first application, fill in company and role (or leave both empty).",
      fieldErrors: { company: v.company ? undefined : ["Required"], role: v.role ? undefined : ["Required"] },
    };
  }

  try {
    const { data: candidateId, error } = await db().rpc("create_candidate", {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_name: v.name,
      p_headline: v.headline,
      p_email: v.email,
      p_skills: v.skills,
    });
    if (error) throw new Error(error.message);

    if (wantsApplication) {
      await insertApplication({ candidateId, company: v.company!, role: v.role!, stageId: v.stageId! });
    }
  } catch (e) {
    console.error("createCandidate failed", e);
    return { ok: false, message: "Couldn't save. Please try again." };
  }

  refresh(); // re-render the current page with fresh data
  return { ok: true, message: `${v.name} added.`, submittedAt: Date.now() };
}

export async function createApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = applicationSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  try {
    await insertApplication(parsed.data);
  } catch (e) {
    console.error("createApplication failed", e);
    return { ok: false, message: "Couldn't save. Please try again." };
  }

  refresh();
  return { ok: true, message: "Application added.", submittedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Move (drag and drop)
// ---------------------------------------------------------------------------
export async function moveApplication(input: z.input<typeof moveSchema>): Promise<{ ok: boolean }> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { applicationId, stageId, prevId, nextId } = parsed.data;

  try {
    // Read the neighbours' current ranks from the DB (the source of truth),
    // then generate a key that sorts between them.
    const neighbourIds = [prevId, nextId].filter((id): id is string => id !== null);
    const { data: neighbours, error } = neighbourIds.length
      ? await db().from("applications").select("id, rank, stage_id").in("id", neighbourIds)
      : { data: [], error: null };
    if (error) throw new Error(error.message);

    const rankOf = (id: string | null) =>
      neighbours.find((n) => n.id === id && n.stage_id === stageId)?.rank ?? null;

    let rank: string;
    try {
      rank = generateKeyBetween(rankOf(prevId), rankOf(nextId));
    } catch {
      // Neighbours moved meanwhile (e.g. another tab): fall back to the bottom
      rank = await rankAtEnd(stageId);
    }

    const { error: moveError } = await db().rpc("move_application", {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_application_id: applicationId,
      p_stage_id: stageId,
      p_rank: rank,
    });
    if (moveError) throw new Error(moveError.message);
  } catch (e) {
    console.error("moveApplication failed", e);
    refresh(); // snap the board back to what the DB says
    return { ok: false };
  }

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Detail panel (Step 2.4)
// ---------------------------------------------------------------------------

/** Stage dropdown: same as dragging the card to the bottom of that column */
export async function changeStage(input: { applicationId: string; stageId: string }): Promise<{ ok: boolean }> {
  const parsed = z.object({ applicationId: uuid, stageId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false };

  try {
    const { error } = await db().rpc("move_application", {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_application_id: parsed.data.applicationId,
      p_stage_id: parsed.data.stageId,
      p_rank: await rankAtEnd(parsed.data.stageId),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("changeStage failed", e);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

export async function setLabel(input: { applicationId: string; labelId: string; on: boolean }): Promise<{ ok: boolean }> {
  const parsed = z.object({ applicationId: uuid, labelId: uuid, on: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false };

  const { error } = await db().rpc("set_application_label", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_application_id: parsed.data.applicationId,
    p_label_id: parsed.data.labelId,
    p_on: parsed.data.on,
  });
  if (error) {
    console.error("setLabel failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

/** Create a new label (or reuse one with the same name) and put it on this card */
export async function createLabelOnCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      applicationId: uuid,
      name: z.string().trim().min(1, "Name is required").max(40),
      color: z.enum(LABEL_COLORS).catch("#64748b"),
    })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const { data: labelId, error } = await db().rpc("create_label", {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_name: parsed.data.name,
      p_color: parsed.data.color,
    });
    if (error) throw new Error(error.message);
    const { error: e2 } = await db().rpc("set_application_label", {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_application_id: parsed.data.applicationId,
      p_label_id: labelId,
      p_on: true,
    });
    if (e2) throw new Error(e2.message);
  } catch (e) {
    console.error("createLabelOnCard failed", e);
    return { ok: false, message: "Couldn't create the label." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

export async function addNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ applicationId: uuid, body: z.string().trim().min(1, "Write something first").max(5000) })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await db().rpc("add_application_note", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_application_id: parsed.data.applicationId,
    p_body: parsed.data.body,
  });
  if (error) {
    console.error("addNote failed", error);
    return { ok: false, message: "Couldn't save the note." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

const listOf = (separator: RegExp, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => [...new Set((v ?? "").split(separator).map((s) => s.trim()).filter(Boolean))].slice(0, max));

const profileSchema = z.object({
  candidateId: uuid,
  name: z.string().trim().min(1, "Name is required").max(120),
  headline: z.string().trim().max(120).optional(),
  yearsExperience: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int("Whole years").min(0).max(60).nullable()),
  email: z
    .union([z.literal(""), z.email("Not a valid email")])
    .optional(),
  phone: z.string().trim().max(40).optional(),
  skills: listOf(/,/, 30),
  links: listOf(/\s+/, 10).pipe(z.array(z.url({ protocol: /^https?$/, error: "Links must start with http:// or https://" }))),
  source: z.string().trim().max(80).optional(),
  context: z.string().trim().max(5000).optional(),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const { error } = await db().rpc("update_candidate", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_candidate_id: v.candidateId,
    p_name: v.name,
    p_headline: v.headline ?? "",
    p_years_experience: v.yearsExperience as number, // null clears it
    p_email: v.email ?? "",
    p_phone: v.phone ?? "",
    p_links: v.links,
    p_skills: v.skills,
    p_source: v.source ?? "",
    p_context: v.context ?? "",
  });
  if (error) {
    console.error("updateProfile failed", error);
    return { ok: false, message: "Couldn't save the profile." };
  }
  refresh();
  return { ok: true, message: "Saved", submittedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Removing engineers and processes
// ---------------------------------------------------------------------------

/** Archive = hide from the board and lists, keep everything. Reversible. */
export async function setCandidateArchived(input: { candidateId: string; archived: boolean }): Promise<{ ok: boolean }> {
  const parsed = z.object({ candidateId: uuid, archived: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db().rpc("set_candidate_archived", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_candidate_id: parsed.data.candidateId,
    p_archived: parsed.data.archived,
  });
  if (error) {
    console.error("setCandidateArchived failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

/** Permanent: the engineer, all their processes, notes and history are gone. */
export async function deleteCandidate(input: { candidateId: string }): Promise<{ ok: boolean }> {
  const parsed = z.object({ candidateId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db()
    .from("candidates")
    .delete()
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.candidateId);
  if (error) {
    console.error("deleteCandidate failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

/** Permanent: one process (card) with its notes, labels and card history. */
export async function deleteApplication(input: { applicationId: string }): Promise<{ ok: boolean }> {
  const parsed = z.object({ applicationId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db().rpc("delete_application", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_application_id: parsed.data.applicationId,
  });
  if (error) {
    console.error("deleteApplication failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Editing and deleting individual notes
// ---------------------------------------------------------------------------
export async function updateNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ noteId: uuid, body: z.string().trim().min(1, "A note can't be empty").max(5000) })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await db()
    .from("application_notes")
    .update({ body: parsed.data.body })
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.noteId);
  if (error) {
    console.error("updateNote failed", error);
    return { ok: false, message: "Couldn't save the note." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

export async function deleteNote(input: { noteId: string }): Promise<{ ok: boolean }> {
  const parsed = z.object({ noteId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db()
    .from("application_notes")
    .delete()
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.noteId);
  if (error) {
    console.error("deleteNote failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------
const companySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  website: z
    .union([z.literal(""), z.url({ protocol: /^https?$/, error: "Must start with http:// or https://" })])
    .optional()
    .transform((v) => v || null),
  context: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => v || null),
});

const DUPLICATE = "23505"; // Postgres error code: unique constraint violated

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = companySchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await db()
    .from("companies")
    .insert({ workspace_id: DEFAULT_WORKSPACE_ID, ...parsed.data });
  if (error) {
    if (error.code === DUPLICATE) return { ok: false, fieldErrors: { name: ["A company with this name already exists"] } };
    console.error("createCompany failed", error);
    return { ok: false, message: "Couldn't save the company." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

export async function updateCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = companySchema.extend({ companyId: uuid }).safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { companyId, ...fields } = parsed.data;

  const { error } = await db()
    .from("companies")
    .update(fields)
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", companyId);
  if (error) {
    if (error.code === DUPLICATE) return { ok: false, fieldErrors: { name: ["A company with this name already exists"] } };
    console.error("updateCompany failed", error);
    return { ok: false, message: "Couldn't save the company." };
  }
  refresh();
  return { ok: true, message: "Saved", submittedAt: Date.now() };
}

/** Only companies with no processes can be deleted (the DB enforces this too). */
export async function deleteCompany(input: { companyId: string }): Promise<{ ok: boolean; message?: string }> {
  const parsed = z.object({ companyId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db()
    .from("companies")
    .delete()
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.companyId);
  if (error) {
    if (error.code === "23503") return { ok: false, message: "Remove this company's processes first." }; // foreign key
    console.error("deleteCompany failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}
