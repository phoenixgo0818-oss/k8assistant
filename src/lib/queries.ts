import "server-only";

import { connection } from "next/server";
import { db, DEFAULT_WORKSPACE_ID } from "./supabase";

// Every query starts with `await connection()`: it tells Next.js this data
// belongs to the request, so it is never fetched (or frozen) at build time.

// ---------------------------------------------------------------------------
// Shapes the UI works with (flattened from the DB rows)
// ---------------------------------------------------------------------------
export type Label = { id: string; name: string; color: string };

export type Stage = {
  id: string;
  name: string;
  color: string;
  isFinal: boolean;
};

export type ApplicationCard = {
  id: string;
  role: string;
  rank: string;
  stageId: string;
  candidate: { id: string; name: string; headline: string | null };
  company: { id: string; name: string };
  labels: Label[];
};

export type BoardColumn = Stage & { cards: ApplicationCard[] };

// One select string reused by the board and the candidate page.
// Supabase follows foreign keys: `candidate:candidates(...)` = join + rename.
const APPLICATION_SELECT = `
  id, role, rank, stage_id,
  candidate:candidates!inner ( id, name, headline, archived_at ),
  company:companies ( id, name ),
  application_labels ( label:labels ( id, name, color ) )
` as const;

type ApplicationRow = {
  id: string;
  role: string;
  rank: string;
  stage_id: string;
  candidate: { id: string; name: string; headline: string | null };
  company: { id: string; name: string };
  application_labels: { label: Label }[];
};

function toCard(row: ApplicationRow): ApplicationCard {
  return {
    id: row.id,
    role: row.role,
    rank: row.rank,
    stageId: row.stage_id,
    candidate: {
      id: row.candidate.id,
      name: row.candidate.name,
      headline: row.candidate.headline,
    },
    company: row.company,
    labels: row.application_labels
      .map((al) => al.label)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---------------------------------------------------------------------------
// Board: every stage (even empty ones) with its cards in rank order
// ---------------------------------------------------------------------------
export async function getBoard(): Promise<BoardColumn[]> {
  await connection();
  const supabase = db();

  // Two queries in parallel instead of one after the other
  const [stagesRes, appsRes] = await Promise.all([
    supabase
      .from("stages")
      .select("id, name, color, is_final")
      .eq("workspace_id", DEFAULT_WORKSPACE_ID)
      .order("sort_order"),
    supabase
      .from("applications")
      .select(APPLICATION_SELECT)
      .eq("workspace_id", DEFAULT_WORKSPACE_ID)
      .is("archived_at", null)
      .is("candidate.archived_at", null) // hide cards of archived engineers
      .order("rank"),
  ]);

  if (stagesRes.error) throw new Error(`Loading stages failed: ${stagesRes.error.message}`);
  if (appsRes.error) throw new Error(`Loading applications failed: ${appsRes.error.message}`);

  const cards = (appsRes.data as unknown as ApplicationRow[]).map(toCard);

  return stagesRes.data.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isFinal: s.is_final,
    // rank is already sorted by the DB, so filter keeps that order
    cards: cards.filter((c) => c.stageId === s.id),
  }));
}

// ---------------------------------------------------------------------------
// Candidates list
// ---------------------------------------------------------------------------
export type CandidateSummary = {
  id: string;
  name: string;
  headline: string | null;
  yearsExperience: number | null;
  skills: string[];
  activeApplications: number;
};

export async function getCandidates(): Promise<CandidateSummary[]> {
  await connection();
  const { data, error } = await db()
    .from("candidates")
    .select("id, name, headline, years_experience, skills, applications ( id, archived_at )")
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .is("archived_at", null)
    .order("name");

  if (error) throw new Error(`Loading candidates failed: ${error.message}`);

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    headline: c.headline,
    yearsExperience: c.years_experience,
    skills: c.skills,
    activeApplications: c.applications.filter((a) => a.archived_at === null).length,
  }));
}

// ---------------------------------------------------------------------------
// One candidate: profile + every process they're in
// ---------------------------------------------------------------------------
export type CandidateDetail = {
  id: string;
  name: string;
  headline: string | null;
  yearsExperience: number | null;
  email: string | null;
  phone: string | null;
  links: string[];
  skills: string[];
  source: string | null;
  context: string | null;
  applications: (ApplicationCard & { stage: Stage })[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCandidate(id: string): Promise<CandidateDetail | null> {
  // A malformed id would make Postgres throw; treat it as "not found" instead
  await connection();
  if (!UUID_RE.test(id)) return null;

  const supabase = db();
  const [candRes, appsRes, stagesRes] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, name, headline, years_experience, email, phone, links, skills, source, context")
      .eq("workspace_id", DEFAULT_WORKSPACE_ID)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select(APPLICATION_SELECT)
      .eq("candidate_id", id)
      .is("archived_at", null),
    supabase
      .from("stages")
      .select("id, name, color, is_final, sort_order")
      .eq("workspace_id", DEFAULT_WORKSPACE_ID),
  ]);

  if (candRes.error) throw new Error(`Loading candidate failed: ${candRes.error.message}`);
  if (appsRes.error) throw new Error(`Loading applications failed: ${appsRes.error.message}`);
  if (stagesRes.error) throw new Error(`Loading stages failed: ${stagesRes.error.message}`);
  if (!candRes.data) return null;

  const stages = new Map(stagesRes.data.map((s) => [s.id, s]));
  const c = candRes.data;

  const applications = (appsRes.data as unknown as ApplicationRow[])
    .map((row) => {
      const s = stages.get(row.stage_id)!;
      return {
        ...toCard(row),
        stage: { id: s.id, name: s.name, color: s.color, isFinal: s.is_final },
        sortOrder: s.sort_order,
      };
    })
    // furthest-along process first; finished ones (Hired/Rejected) last
    .sort((a, b) => Number(a.stage.isFinal) - Number(b.stage.isFinal) || b.sortOrder - a.sortOrder)
    .map((app) => {
      const { sortOrder, ...rest } = app;
      void sortOrder; // only used for sorting above
      return rest;
    });

  return {
    id: c.id,
    name: c.name,
    headline: c.headline,
    yearsExperience: c.years_experience,
    email: c.email,
    phone: c.phone,
    links: c.links,
    skills: c.skills,
    source: c.source,
    context: c.context,
    applications,
  };
}

// ---------------------------------------------------------------------------
// Options for the "new candidate / new application" forms
// ---------------------------------------------------------------------------
export type FormOptions = {
  candidates: { id: string; name: string }[];
  companies: string[];
  stages: { id: string; name: string }[];
};

export async function getFormOptions(): Promise<FormOptions> {
  await connection();
  const supabase = db();
  const [cands, comps, stages] = await Promise.all([
    supabase.from("candidates").select("id, name").eq("workspace_id", DEFAULT_WORKSPACE_ID).is("archived_at", null).order("name"),
    supabase.from("companies").select("name").eq("workspace_id", DEFAULT_WORKSPACE_ID).order("name"),
    supabase.from("stages").select("id, name").eq("workspace_id", DEFAULT_WORKSPACE_ID).order("sort_order"),
  ]);
  for (const r of [cands, comps, stages]) if (r.error) throw new Error(`Loading form options failed: ${r.error.message}`);

  return {
    candidates: cands.data!,
    companies: comps.data!.map((c) => c.name),
    stages: stages.data!,
  };
}
