"use server";

// Server Actions: functions that run on the server but can be called from
// forms and buttons in the browser. Next.js turns each export into an HTTP
// endpoint, so treat every argument as untrusted input and validate it.

import { refresh } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/supabase";

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
