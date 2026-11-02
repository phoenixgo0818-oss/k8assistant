-- =============================================================================
-- K8assistant — Phase 2.1: Pipeline Board schema
--
-- Model (see docs/BUILD_PLAN.md "Changes from PLAN.md"):
--   candidate  = an engineer I manage (profile entered once)
--   company    = a company my engineers interview with
--   application = candidate × company × role  → ONE CARD on the board
--
-- Every table has workspace_id so Phase 5 (multi-user) needs no data migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- workspaces — the team unit. Only one (the default) until Phase 5.
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stages — board columns. Presets are just seeded rows (is_preset = true),
-- so preset and custom stages share one code path.
-- ---------------------------------------------------------------------------
create table public.stages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  color        text not null default '#64748b',
  sort_order   integer not null,
  is_preset    boolean not null default false,
  is_final     boolean not null default false,   -- e.g. Hired / Rejected: collapsible
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

-- ---------------------------------------------------------------------------
-- labels — chips on a card: "what are we waiting for?" (zero or more per card)
-- ---------------------------------------------------------------------------
create table public.labels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  color        text not null default '#64748b',
  is_preset    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

-- ---------------------------------------------------------------------------
-- companies — where my engineers interview
-- ---------------------------------------------------------------------------
create table public.companies (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  website      text,
  context      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

-- ---------------------------------------------------------------------------
-- candidates — engineers I manage. Only name is required.
-- (Called "candidates", not "profiles", so it never clashes with app users
--  in Phase 3's user_profiles.)
-- ---------------------------------------------------------------------------
create table public.candidates (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  headline         text,                        -- e.g. "Backend engineer"
  years_experience integer check (years_experience between 0 and 60),
  email            text,
  phone            text,
  links            text[] not null default '{}', -- GitHub, LinkedIn, CV links
  skills           text[] not null default '{}', -- Go, Postgres, Kafka
  source           text,                        -- Referral, LinkedIn, ...
  context          text,                        -- background that rarely changes
  archived_at      timestamptz,                 -- archive, never hard-delete (v1)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- applications — ONE CARD. One candidate can have many (one per process).
--
-- rank: position inside its stage column using fractional indexing.
--   Keys are strings that sort between each other ("a0" < "a0V" < "a1"),
--   so moving a card updates ONE row instead of renumbering the column.
--   COLLATE "C" = plain byte order, which is what the keys are designed for.
-- ---------------------------------------------------------------------------
create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete restrict,
  role         text not null check (length(trim(role)) > 0),
  stage_id     uuid not null references public.stages (id) on delete restrict,
  rank         text collate "C" not null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The board query: "cards in this stage, in order"
create index applications_stage_rank_idx on public.applications (stage_id, rank);
-- The candidate page: "all processes for this engineer"
create index applications_candidate_idx on public.applications (candidate_id);

-- ---------------------------------------------------------------------------
-- application_labels — many-to-many: a card has many labels, a label many cards
-- ---------------------------------------------------------------------------
create table public.application_labels (
  application_id uuid not null references public.applications (id) on delete cascade,
  label_id       uuid not null references public.labels (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (application_id, label_id)
);

-- "everyone waiting on X" filter
create index application_labels_label_idx on public.application_labels (label_id);

-- ---------------------------------------------------------------------------
-- application_notes — interview feedback / call summaries.
-- stage_id records the stage AT THE MOMENT the note was written.
-- ---------------------------------------------------------------------------
create table public.application_notes (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  stage_id       uuid references public.stages (id) on delete set null,
  body           text not null check (length(trim(body)) > 0),
  created_at     timestamptz not null default now()
);

create index application_notes_application_idx
  on public.application_notes (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- activities — automatic history. candidate_id is always set; application_id
-- is set for card-level events (stage move, labels), null for profile edits.
-- from_value / to_value store readable names ("Screening" → "Tech Call").
-- ---------------------------------------------------------------------------
create table public.activities (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  candidate_id   uuid not null references public.candidates (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  type           text not null check (type in (
                   'candidate_created', 'candidate_updated', 'candidate_archived',
                   'application_created', 'stage_changed',
                   'label_added', 'label_removed', 'application_archived'
                 )),
  field          text,      -- which field changed, for *_updated events
  from_value     text,
  to_value       text,
  created_at     timestamptz not null default now()
);

create index activities_candidate_idx   on public.activities (candidate_id, created_at desc);
create index activities_application_idx on public.activities (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger companies_updated_at    before update on public.companies
  for each row execute function public.set_updated_at();
create trigger candidates_updated_at   before update on public.candidates
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: ON for every table, with NO policies yet.
--
-- Supabase exposes tables through a public API using the "anon" key, which
-- ends up in the browser. RLS with no policies = that key can read nothing.
-- Our Next.js server talks to the DB with the secret key (server-only), which
-- bypasses RLS. Real per-user policies arrive in Step 3.4 with sign-in.
-- ---------------------------------------------------------------------------
alter table public.workspaces         enable row level security;
alter table public.stages             enable row level security;
alter table public.labels             enable row level security;
alter table public.companies          enable row level security;
alter table public.candidates         enable row level security;
alter table public.applications       enable row level security;
alter table public.application_labels enable row level security;
alter table public.application_notes  enable row level security;
alter table public.activities         enable row level security;
