import "server-only";

import { connection } from "next/server";
import { db, DEFAULT_WORKSPACE_ID } from "./supabase";
import { requireUser } from "./auth";
import { formatTime, todayIn, upcomingEvents, type IsoDate, type Priority, type Todo } from "./todos";

// Every query starts with `await connection()`: it tells Next.js this data
// belongs to the request, so it is never fetched (or frozen) at build time.
// Then `await requireUser()`: no signed-in, allowlisted user, no data.

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
  candidate: { id: string; name: string; headline: string | null; color: string; skills: string[] };
  company: { id: string; name: string };
  labels: Label[];
  noteCount: number;
};

export type BoardColumn = Stage & { cards: ApplicationCard[] };

// One select string reused by the board and the candidate page.
// Supabase follows foreign keys: `candidate:candidates(...)` = join + rename.
const APPLICATION_SELECT = `
  id, role, rank, stage_id,
  candidate:candidates!inner ( id, name, headline, color, skills, archived_at ),
  company:companies ( id, name ),
  application_labels ( label:labels ( id, name, color ) ),
  application_notes ( count )
` as const;

type ApplicationRow = {
  id: string;
  role: string;
  rank: string;
  stage_id: string;
  candidate: { id: string; name: string; headline: string | null; color: string; skills: string[] };
  company: { id: string; name: string };
  application_labels: { label: Label }[];
  application_notes: { count: number }[];
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
      color: row.candidate.color,
      skills: row.candidate.skills,
    },
    company: row.company,
    labels: row.application_labels
      .map((al) => al.label)
      .sort((a, b) => a.name.localeCompare(b.name)),
    noteCount: row.application_notes[0]?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Board: every stage (even empty ones) with its cards in rank order
// ---------------------------------------------------------------------------
export async function getBoard(): Promise<BoardColumn[]> {
  await connection();
  await requireUser();
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
  color: string;
  yearsExperience: number | null;
  skills: string[];
  activeApplications: number;
};

export async function getCandidates(): Promise<CandidateSummary[]> {
  await connection();
  await requireUser();
  const { data, error } = await db()
    .from("candidates")
    .select("id, name, headline, color, years_experience, skills, applications ( id, archived_at )")
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .is("archived_at", null)
    .order("name");

  if (error) throw new Error(`Loading candidates failed: ${error.message}`);

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    headline: c.headline,
    color: c.color,
    yearsExperience: c.years_experience,
    skills: c.skills,
    activeApplications: c.applications.filter((a) => a.archived_at === null).length,
  }));
}

export async function getArchivedCandidates(): Promise<{ id: string; name: string; color: string; archivedAt: string }[]> {
  await connection();
  await requireUser();
  const { data, error } = await db()
    .from("candidates")
    .select("id, name, color, archived_at")
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) throw new Error(`Loading archived candidates failed: ${error.message}`);
  return data.map((c) => ({ id: c.id, name: c.name, color: c.color, archivedAt: c.archived_at! }));
}

// ---------------------------------------------------------------------------
// One candidate: profile + every process they're in
// ---------------------------------------------------------------------------
export type CandidateDetail = {
  id: string;
  name: string;
  headline: string | null;
  color: string;
  yearsExperience: number | null;
  email: string | null;
  phone: string | null;
  links: string[];
  skills: string[];
  source: string | null;
  context: string | null;
  archivedAt: string | null;
  applications: (ApplicationCard & { stage: Stage })[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCandidate(id: string): Promise<CandidateDetail | null> {
  // A malformed id would make Postgres throw; treat it as "not found" instead
  await connection();
  await requireUser();
  if (!UUID_RE.test(id)) return null;

  const supabase = db();
  const [candRes, appsRes, stagesRes] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, name, headline, color, years_experience, email, phone, links, skills, source, context, archived_at")
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
    color: c.color,
    yearsExperience: c.years_experience,
    email: c.email,
    phone: c.phone,
    links: c.links,
    skills: c.skills,
    source: c.source,
    context: c.context,
    archivedAt: c.archived_at,
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
  labels: Label[];
};

export async function getFormOptions(): Promise<FormOptions> {
  await connection();
  await requireUser();
  const supabase = db();
  const [cands, comps, stages, labels] = await Promise.all([
    supabase.from("candidates").select("id, name").eq("workspace_id", DEFAULT_WORKSPACE_ID).is("archived_at", null).order("name"),
    supabase.from("companies").select("name").eq("workspace_id", DEFAULT_WORKSPACE_ID).order("name"),
    supabase.from("stages").select("id, name").eq("workspace_id", DEFAULT_WORKSPACE_ID).order("sort_order"),
    supabase.from("labels").select("id, name, color").eq("workspace_id", DEFAULT_WORKSPACE_ID).order("name"),
  ]);
  for (const r of [cands, comps, stages, labels]) if (r.error) throw new Error(`Loading form options failed: ${r.error.message}`);

  return {
    candidates: cands.data!,
    companies: comps.data!.map((c) => c.name),
    stages: stages.data!,
    labels: labels.data!,
  };
}

// ---------------------------------------------------------------------------
// Detail panel: one application with everything the side panel shows
// ---------------------------------------------------------------------------
export type Note = { id: string; body: string; createdAt: string; stageName: string | null };

export type Activity = {
  id: string;
  type: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  /** true = about the engineer's profile, shared by all their processes */
  profileLevel: boolean;
};

export type ApplicationDetail = {
  id: string;
  role: string;
  stageId: string;
  company: { id: string; name: string };
  candidate: Omit<CandidateDetail, "applications" | "archivedAt"> & { otherProcesses: number };
  labels: Label[];
  allLabels: Label[];
  stages: { id: string; name: string; color: string }[];
  notes: Note[];
  activities: Activity[];
};

export async function getApplicationDetail(id: string): Promise<ApplicationDetail | null> {
  await connection();
  await requireUser();
  if (!UUID_RE.test(id)) return null;

  const supabase = db();
  const { data: app, error } = await supabase
    .from("applications")
    .select(
      `id, role, stage_id, candidate_id,
       company:companies ( id, name ),
       candidate:candidates ( id, name, headline, color, years_experience, email, phone, links, skills, source, context ),
       application_labels ( label:labels ( id, name, color ) )`,
    )
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`Loading application failed: ${error.message}`);
  if (!app) return null;

  const [labelsRes, stagesRes, notesRes, actsRes, siblingsRes] = await Promise.all([
    supabase.from("labels").select("id, name, color").eq("workspace_id", DEFAULT_WORKSPACE_ID).order("name"),
    supabase.from("stages").select("id, name, color").eq("workspace_id", DEFAULT_WORKSPACE_ID).order("sort_order"),
    supabase
      .from("application_notes")
      .select("id, body, created_at, stage:stages ( name )")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    // This card's events + the engineer's profile events (application_id is null)
    supabase
      .from("activities")
      .select("id, type, field, from_value, to_value, created_at, application_id")
      .eq("candidate_id", app.candidate_id)
      .or(`application_id.eq.${id},application_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", app.candidate_id)
      .is("archived_at", null)
      .neq("id", id),
  ]);
  for (const r of [labelsRes, stagesRes, notesRes, actsRes, siblingsRes]) {
    if (r.error) throw new Error(`Loading card details failed: ${r.error.message}`);
  }

  const c = app.candidate as unknown as {
    id: string; name: string; headline: string | null; color: string; years_experience: number | null;
    email: string | null; phone: string | null; links: string[]; skills: string[];
    source: string | null; context: string | null;
  };

  return {
    id: app.id,
    role: app.role,
    stageId: app.stage_id,
    company: app.company as unknown as { id: string; name: string },
    candidate: {
      id: c.id,
      name: c.name,
      headline: c.headline,
      color: c.color,
      yearsExperience: c.years_experience,
      email: c.email,
      phone: c.phone,
      links: c.links,
      skills: c.skills,
      source: c.source,
      context: c.context,
      otherProcesses: siblingsRes.count ?? 0,
    },
    labels: (app.application_labels as unknown as { label: Label }[]).map((al) => al.label),
    allLabels: labelsRes.data!,
    stages: stagesRes.data!,
    notes: (notesRes.data as unknown as { id: string; body: string; created_at: string; stage: { name: string } | null }[]).map(
      (n) => ({ id: n.id, body: n.body, createdAt: n.created_at, stageName: n.stage?.name ?? null }),
    ),
    activities: actsRes.data!.map((a) => ({
      id: a.id,
      type: a.type,
      field: a.field,
      fromValue: a.from_value,
      toValue: a.to_value,
      createdAt: a.created_at,
      profileLevel: a.application_id === null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------
export type CompanySummary = {
  id: string;
  name: string;
  website: string | null;
  processes: number;
  engineers: number;
};

export async function getCompanies(): Promise<CompanySummary[]> {
  await connection();
  await requireUser();
  const { data, error } = await db()
    .from("companies")
    .select("id, name, website, applications ( candidate_id, archived_at, candidate:candidates ( archived_at ) )")
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .order("name");
  if (error) throw new Error(`Loading companies failed: ${error.message}`);

  return data.map((c) => {
    const active = (c.applications as unknown as { candidate_id: string; archived_at: string | null; candidate: { archived_at: string | null } }[])
      .filter((a) => a.archived_at === null && a.candidate.archived_at === null);
    return {
      id: c.id,
      name: c.name,
      website: c.website,
      processes: active.length,
      engineers: new Set(active.map((a) => a.candidate_id)).size,
    };
  });
}

export type CompanyDetail = {
  id: string;
  name: string;
  website: string | null;
  context: string | null;
  processes: {
    id: string;
    role: string;
    candidate: { id: string; name: string; color: string; archived: boolean };
    stage: { name: string; color: string; isFinal: boolean; sortOrder: number };
  }[];
};

export async function getCompany(id: string): Promise<CompanyDetail | null> {
  await connection();
  await requireUser();
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await db()
    .from("companies")
    .select(
      `id, name, website, context,
       applications ( id, role, archived_at,
         candidate:candidates ( id, name, color, archived_at ),
         stage:stages ( name, color, is_final, sort_order ) )`,
    )
    .eq("workspace_id", DEFAULT_WORKSPACE_ID)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Loading company failed: ${error.message}`);
  if (!data) return null;

  type Row = {
    id: string; role: string; archived_at: string | null;
    candidate: { id: string; name: string; color: string; archived_at: string | null };
    stage: { name: string; color: string; is_final: boolean; sort_order: number };
  };
  const processes = (data.applications as unknown as Row[])
    .filter((a) => a.archived_at === null)
    .map((a) => ({
      id: a.id,
      role: a.role,
      candidate: { id: a.candidate.id, name: a.candidate.name, color: a.candidate.color, archived: a.candidate.archived_at !== null },
      stage: { name: a.stage.name, color: a.stage.color, isFinal: a.stage.is_final, sortOrder: a.stage.sort_order },
    }))
    // active processes first, furthest along first
    .sort((a, b) => Number(a.stage.isFinal) - Number(b.stage.isFinal) || b.stage.sortOrder - a.stage.sortOrder);

  return { id: data.id, name: data.name, website: data.website, context: data.context, processes };
}

// ---------------------------------------------------------------------------
// Upcoming events (to-dos) for the panel under the board
// ---------------------------------------------------------------------------
export type TodoLinkOption = { value: string; label: string };

export type UpcomingData = {
  today: IsoDate;
  /** Open events in time order (late ones first) */
  events: Todo[];
  /** For the "Link to" picker: engineers and their active processes */
  linkOptions: { engineers: TodoLinkOption[]; processes: TodoLinkOption[] };
};

type TodoRow = {
  id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  priority: Priority;
  done_at: string | null;
  carried_over: number;
  candidate: { id: string; name: string; color: string } | null;
  application: { id: string; role: string; company: { name: string }; candidate: { name: string; color: string } } | null;
};

export async function getUpcomingEvents(): Promise<UpcomingData> {
  await connection();
  await requireUser();
  const today = todayIn();
  const supabase = db();

  const [todosRes, candsRes, appsRes] = await Promise.all([
    supabase
      .from("todos")
      .select(`
        id, title, due_date, due_time, priority, done_at, carried_over,
        candidate:candidates ( id, name, color ),
        application:applications ( id, role, company:companies ( name ), candidate:candidates ( name, color ) )
      `)
      .eq("workspace_id", DEFAULT_WORKSPACE_ID)
      .is("done_at", null) // finished events leave the list
      .not("due_date", "is", null),
    supabase.from("candidates").select("id, name").eq("workspace_id", DEFAULT_WORKSPACE_ID).is("archived_at", null).order("name"),
    supabase
      .from("applications")
      .select("id, role, company:companies ( name ), candidate:candidates!inner ( name, archived_at )")
      .eq("workspace_id", DEFAULT_WORKSPACE_ID)
      .is("archived_at", null)
      .is("candidate.archived_at", null),
  ]);
  for (const r of [todosRes, candsRes, appsRes]) if (r.error) throw new Error(`Loading events failed: ${r.error.message}`);

  const todos = (todosRes.data as unknown as TodoRow[]).map((t): Todo => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_date,
    dueTime: formatTime(t.due_time),
    priority: t.priority,
    doneAt: t.done_at,
    carriedOver: t.carried_over,
    link: t.application
      ? {
          kind: "application",
          id: t.application.id,
          name: t.application.candidate.name,
          color: t.application.candidate.color,
          company: t.application.company.name,
          role: t.application.role,
        }
      : t.candidate
        ? { kind: "candidate", id: t.candidate.id, name: t.candidate.name, color: t.candidate.color }
        : null,
  }));

  const processes = (appsRes.data as unknown as { id: string; role: string; company: { name: string }; candidate: { name: string } }[])
    .map((a) => ({ value: `application:${a.id}`, label: `${a.candidate.name} · ${a.company.name} – ${a.role}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    today,
    events: upcomingEvents(todos), // pure: sorting rules live in src/lib/todos.ts
    linkOptions: {
      engineers: candsRes.data!.map((c) => ({ value: `candidate:${c.id}`, label: c.name })),
      processes,
    },
  };
}
