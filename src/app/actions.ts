"use server";

// Server Actions: functions that run on the server but can be called from
// forms and buttons in the browser. Next.js turns each export into an HTTP
// endpoint, so treat every argument as untrusted input and validate it.
// Being public endpoints, each one also starts with requireUser(): proxy.ts
// alone isn't enough, because anyone can POST to an action directly.

import { refresh } from "next/cache";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import { z } from "zod";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { ENGINEER_COLORS, LABEL_COLORS } from "@/lib/constants";
import { PRIORITIES, resolveDue, todayIn } from "@/lib/todos";

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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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

// ---------------------------------------------------------------------------
// Engineer colour
// ---------------------------------------------------------------------------
export async function setCandidateColor(input: { candidateId: string; color: string }): Promise<{ ok: boolean }> {
  await requireUser();
  const parsed = z.object({ candidateId: uuid, color: z.enum(ENGINEER_COLORS) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db()
    .from("candidates")
    .update({ color: parsed.data.color })
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.candidateId);
  if (error) {
    console.error("setCandidateColor failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Board columns (stages)
// ---------------------------------------------------------------------------
export async function createStage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name is required").max(40),
      color: z.enum(LABEL_COLORS).catch("#64748b"),
    })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await db().rpc("create_stage", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_name: parsed.data.name,
    p_color: parsed.data.color,
  });
  if (error) {
    if (error.code === DUPLICATE) return { ok: false, fieldErrors: { name: ["A column with this name already exists"] } };
    console.error("createStage failed", error);
    return { ok: false, message: "Couldn't add the column." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

/** Remove a column; its cards (if any) go to the bottom of `targetStageId`, in order. */
export async function deleteStage(input: { stageId: string; targetStageId: string | null }): Promise<{ ok: boolean; message?: string }> {
  await requireUser();
  const parsed = z.object({ stageId: uuid, targetStageId: uuid.nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { stageId, targetStageId } = parsed.data;

  try {
    // Every card in the column, including hidden ones of archived engineers
    const { data: apps, error } = await db()
      .from("applications")
      .select("id")
      .eq("stage_id", stageId)
      .order("rank");
    if (error) throw new Error(error.message);

    let ranks: string[] = [];
    if (apps.length > 0) {
      if (!targetStageId) return { ok: false, message: "Choose where its cards should go." };
      ranks = generateNKeysBetween(await lastRankInStage(targetStageId), null, apps.length);
    }

    const { error: rpcError } = await db().rpc("delete_stage", {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_stage_id: stageId,
      p_target_stage_id: targetStageId as string, // null is fine when the column is empty
      p_application_ids: apps.map((a) => a.id),
      p_ranks: ranks,
    });
    if (rpcError) return { ok: false, message: rpcError.message };
  } catch (e) {
    console.error("deleteStage failed", e);
    return { ok: false, message: "Couldn't remove the column." };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 2.5: edit / reorder columns, edit / delete labels
// ---------------------------------------------------------------------------
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

export async function updateStage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = z
    .object({
      stageId: uuid,
      name: z.string().trim().min(1, "Name is required").max(40),
      color: z.enum(LABEL_COLORS).catch("#64748b"),
      isFinal: checkbox,
    })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const { error } = await db()
    .from("stages")
    .update({ name: v.name, color: v.color, is_final: v.isFinal })
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", v.stageId);
  if (error) {
    if (error.code === DUPLICATE) return { ok: false, fieldErrors: { name: ["A column with this name already exists"] } };
    console.error("updateStage failed", error);
    return { ok: false, message: "Couldn't save the column." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

export async function moveStage(input: { stageId: string; direction: -1 | 1 }): Promise<{ ok: boolean }> {
  await requireUser();
  const parsed = z.object({ stageId: uuid, direction: z.union([z.literal(-1), z.literal(1)]) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db().rpc("move_stage", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_stage_id: parsed.data.stageId,
    p_direction: parsed.data.direction,
  });
  if (error) {
    console.error("moveStage failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

export async function updateLabel(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = z
    .object({
      labelId: uuid,
      name: z.string().trim().min(1, "Name is required").max(40),
      color: z.enum(LABEL_COLORS).catch("#64748b"),
    })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await db()
    .from("labels")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.labelId);
  if (error) {
    if (error.code === DUPLICATE) return { ok: false, fieldErrors: { name: ["A label with this name already exists"] } };
    console.error("updateLabel failed", error);
    return { ok: false, message: "Couldn't save the label." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

/** Removes the label from every card (each gets a history entry), then deletes it. */
export async function deleteLabel(input: { labelId: string }): Promise<{ ok: boolean; message?: string }> {
  await requireUser();
  const parsed = z.object({ labelId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db().rpc("delete_label", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_label_id: parsed.data.labelId,
  });
  if (error) {
    console.error("deleteLabel failed", error);
    return { ok: false, message: "Couldn't delete the label." };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// To-dos (step 3.2)
// ---------------------------------------------------------------------------
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").refine((d) => !Number.isNaN(Date.parse(d)), "Not a real date");

const todoSchema = z
  .object({
    title: z.string().trim().min(1, "What needs doing?").max(200),
    // The "When" picker: a shortcut, or "date" + the date input
    due: z.enum(["today", "tomorrow", "someday", "date"]),
    dueDate: z.string().optional(),
    priority: z.enum(PRIORITIES),
    // "" | "candidate:<uuid>" | "application:<uuid>"
    link: z
      .string()
      .optional()
      .transform((v) => v || "")
      .pipe(z.union([z.literal(""), z.string().regex(/^(candidate|application):[0-9a-f-]{36}$/i, "Pick from the list")])),
  })
  .superRefine((v, ctx) => {
    if (v.due === "date" && !isoDate.safeParse(v.dueDate).success) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Pick a date" });
    }
  });

/** Form values → DB columns. "today"/"tomorrow" are resolved in the app's time zone. */
function todoColumns(v: z.output<typeof todoSchema>) {
  const [kind, id] = v.link ? v.link.split(":") : [null, null];
  return {
    title: v.title,
    due_date: resolveDue(v.due === "date" ? v.dueDate! : v.due, todayIn()),
    priority: v.priority,
    candidate_id: kind === "candidate" ? id : null,
    application_id: kind === "application" ? id : null,
  };
}

const FOREIGN_KEY = "23503"; // the linked engineer/process no longer exists

export async function createTodo(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = todoSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await db()
    .from("todos")
    .insert({ workspace_id: DEFAULT_WORKSPACE_ID, ...todoColumns(parsed.data) });
  if (error) {
    if (error.code === FOREIGN_KEY) return { ok: false, fieldErrors: { link: ["That engineer or process was removed"] } };
    console.error("createTodo failed", error);
    return { ok: false, message: "Couldn't save the to-do." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

export async function updateTodo(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = z.object({ todoId: uuid }).and(todoSchema).safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  // Editing the date by hand is a deliberate re-plan, not a carry-over,
  // so this is a plain update (moveTodo below is what counts carry-overs).
  const { error } = await db()
    .from("todos")
    .update(todoColumns(parsed.data))
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.todoId);
  if (error) {
    if (error.code === FOREIGN_KEY) return { ok: false, fieldErrors: { link: ["That engineer or process was removed"] } };
    console.error("updateTodo failed", error);
    return { ok: false, message: "Couldn't save the to-do." };
  }
  refresh();
  return { ok: true, submittedAt: Date.now() };
}

export async function setTodoDone(input: { todoId: string; done: boolean }): Promise<{ ok: boolean }> {
  await requireUser();
  const parsed = z.object({ todoId: uuid, done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db()
    .from("todos")
    .update({ done_at: parsed.data.done ? new Date().toISOString() : null })
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.todoId);
  if (error) {
    console.error("setTodoDone failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

/** Quick reschedule buttons. Moving an overdue item counts as a carry-over (in SQL). */
export async function moveTodo(input: { todoId: string; to: "today" | "tomorrow" | "someday" }): Promise<{ ok: boolean }> {
  await requireUser();
  const parsed = z.object({ todoId: uuid, to: z.enum(["today", "tomorrow", "someday"]) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const today = todayIn();
  const { error } = await db().rpc("move_todo", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_todo_id: parsed.data.todoId,
    // generated types say string, but null (= Someday) is what SQL receives
    p_due_date: resolveDue(parsed.data.to, today) as string,
    p_today: today,
  });
  if (error) {
    console.error("moveTodo failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

/** "Move all to today": every open to-do from an earlier day. */
export async function carryOverTodos(): Promise<{ ok: boolean; count?: number }> {
  await requireUser();
  const { data, error } = await db().rpc("carry_over_todos", {
    p_workspace_id: DEFAULT_WORKSPACE_ID,
    p_today: todayIn(),
  });
  if (error) {
    console.error("carryOverTodos failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true, count: data };
}

export async function deleteTodo(input: { todoId: string }): Promise<{ ok: boolean }> {
  await requireUser();
  const parsed = z.object({ todoId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { error } = await db()
    .from("todos")
    .delete()
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", parsed.data.todoId);
  if (error) {
    console.error("deleteTodo failed", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}
