-- =============================================================================
-- K8assistant — Phase 3.2: Daily To-do
--
-- One row per to-do. A to-do can optionally point at ONE engineer (candidate)
-- or ONE process (application), e.g. "Send Ada the prep pack" or
-- "Chase Northwind for feedback".
--
-- Carry-over: an unfinished to-do whose day has passed is never lost. The app
-- shows it under "From earlier"; moving it forward (one by one or all at once)
-- goes through the functions below, which also count how often it rolled.
-- =============================================================================

create table public.todos (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  title          text not null check (length(trim(title)) between 1 and 200),
  due_date       date,                                -- null = "Someday" (no day planned)
  priority       text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  done_at        timestamptz,                         -- null = still open
  -- Optional link. "set null" (not cascade): deleting an engineer or process
  -- keeps the to-do, it just loses the link.
  candidate_id   uuid references public.candidates (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  carried_over   integer not null default 0 check (carried_over >= 0), -- times rolled to a later day
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A process already belongs to an engineer, so link one or the other, not both
  constraint todos_one_link check (candidate_id is null or application_id is null)
);

-- The Today page: "open to-dos by day" (+ recently done ones)
create index todos_workspace_due_idx on public.todos (workspace_id, done_at, due_date);
-- Foreign keys aren't indexed automatically; these keep "set null" on delete fast
create index todos_candidate_idx   on public.todos (candidate_id)   where candidate_id is not null;
create index todos_application_idx on public.todos (application_id) where application_id is not null;

create trigger todos_updated_at before update on public.todos
  for each row execute function public.set_updated_at();

-- Same rule as every table: RLS on, no policies, only the server's secret key
-- can read/write (real per-user policies arrive in step 3.5).
alter table public.todos enable row level security;

-- ---------------------------------------------------------------------------
-- Move one to-do to a new day (null = Someday).
-- If it was overdue (an earlier day, still open), that counts as a carry-over.
-- p_today comes from the app so "today" uses the app's time zone, not the
-- database server's.
-- ---------------------------------------------------------------------------
create function public.move_todo(
  p_workspace_id uuid,
  p_todo_id      uuid,
  p_due_date     date,
  p_today        date
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.todos
  set carried_over = carried_over
        + case when done_at is null and due_date < p_today then 1 else 0 end,
      due_date = p_due_date
  where workspace_id = p_workspace_id and id = p_todo_id;

  if not found then
    raise exception 'To-do not found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Morning carry-over: every open to-do from an earlier day moves to today.
-- Returns how many moved. Safe to run twice (the second run finds nothing),
-- so the scheduled job in step 4.5 can call it every morning.
-- ---------------------------------------------------------------------------
create function public.carry_over_todos(p_workspace_id uuid, p_today date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.todos
  set due_date = p_today,
      carried_over = carried_over + 1
  where workspace_id = p_workspace_id
    and done_at is null
    and due_date < p_today;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Like the other write functions: callable only by the server (secret key),
-- never through the public API with the publishable key.
revoke execute on function public.move_todo(uuid, uuid, date, date) from public, anon, authenticated;
revoke execute on function public.carry_over_todos(uuid, date) from public, anon, authenticated;
grant execute on function public.move_todo(uuid, uuid, date, date) to service_role;
grant execute on function public.carry_over_todos(uuid, date) to service_role;
