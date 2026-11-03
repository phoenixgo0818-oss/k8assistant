-- =============================================================================
-- K8assistant — Phase 2.3: write operations as database functions
--
-- Why functions (RPC) instead of several API calls from the app?
-- A Postgres function runs in ONE transaction: either every statement in it
-- succeeds, or none do. "Move card + write activity" can never half-happen.
--
-- Ranks (fractional-index keys) are computed in the app and passed in, because
-- the key-generation algorithm lives in the `fractional-indexing` npm package.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Find a company by name (case-insensitive) or create it
-- ---------------------------------------------------------------------------
create function public.find_or_create_company(p_workspace_id uuid, p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_name text := trim(p_name);
  v_id   uuid;
begin
  if v_name = '' then
    raise exception 'Company name is required';
  end if;

  select id into v_id
  from public.companies
  where workspace_id = p_workspace_id and lower(name) = lower(v_name);

  if v_id is null then
    insert into public.companies (workspace_id, name)
    values (p_workspace_id, v_name)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- New candidate (+ "candidate_created" activity)
-- ---------------------------------------------------------------------------
create function public.create_candidate(
  p_workspace_id uuid,
  p_name         text,
  p_headline     text default null,
  p_email        text default null,
  p_skills       text[] default '{}'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.candidates (workspace_id, name, headline, email, skills)
  values (p_workspace_id, trim(p_name), nullif(trim(p_headline), ''),
          nullif(trim(p_email), ''), coalesce(p_skills, '{}'))
  returning id into v_id;

  insert into public.activities (workspace_id, candidate_id, type, to_value)
  values (p_workspace_id, v_id, 'candidate_created', trim(p_name));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- New application = new card (+ "application_created" activity)
-- ---------------------------------------------------------------------------
create function public.create_application(
  p_workspace_id uuid,
  p_candidate_id uuid,
  p_company_name text,
  p_role         text,
  p_stage_id     uuid,
  p_rank         text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_id         uuid;
begin
  -- Guard against ids from another workspace (matters once Phase 5 adds more)
  if not exists (select 1 from public.candidates
                 where id = p_candidate_id and workspace_id = p_workspace_id) then
    raise exception 'Candidate not found';
  end if;
  if not exists (select 1 from public.stages
                 where id = p_stage_id and workspace_id = p_workspace_id) then
    raise exception 'Stage not found';
  end if;

  v_company_id := public.find_or_create_company(p_workspace_id, p_company_name);

  insert into public.applications (workspace_id, candidate_id, company_id, role, stage_id, rank)
  values (p_workspace_id, p_candidate_id, v_company_id, trim(p_role), p_stage_id, p_rank)
  returning id into v_id;

  insert into public.activities (workspace_id, candidate_id, application_id, type, to_value)
  select p_workspace_id, p_candidate_id, v_id, 'application_created', c.name
  from public.companies c where c.id = v_company_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Move a card: new stage and/or new position. Logs "stage_changed" only when
-- the stage actually changed (reordering inside a column isn't history).
-- ---------------------------------------------------------------------------
create function public.move_application(
  p_workspace_id   uuid,
  p_application_id uuid,
  p_stage_id       uuid,
  p_rank           text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_app       public.applications%rowtype;
  v_from_name text;
  v_to_name   text;
begin
  -- FOR UPDATE locks the row so two moves of the same card can't interleave
  select * into v_app
  from public.applications
  where id = p_application_id and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  select name into v_to_name
  from public.stages where id = p_stage_id and workspace_id = p_workspace_id;
  if v_to_name is null then
    raise exception 'Stage not found';
  end if;

  update public.applications
  set stage_id = p_stage_id, rank = p_rank
  where id = p_application_id;

  if v_app.stage_id <> p_stage_id then
    select name into v_from_name from public.stages where id = v_app.stage_id;

    insert into public.activities
      (workspace_id, candidate_id, application_id, type, from_value, to_value)
    values
      (p_workspace_id, v_app.candidate_id, p_application_id, 'stage_changed', v_from_name, v_to_name);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only our server (service_role / secret key) may call these.
-- Supabase would otherwise expose every public function to the anon key.
-- ---------------------------------------------------------------------------
revoke execute on function public.find_or_create_company(uuid, text)                    from public, anon, authenticated;
revoke execute on function public.create_candidate(uuid, text, text, text, text[])     from public, anon, authenticated;
revoke execute on function public.create_application(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.move_application(uuid, uuid, uuid, text)              from public, anon, authenticated;

grant execute on function public.find_or_create_company(uuid, text)                    to service_role;
grant execute on function public.create_candidate(uuid, text, text, text, text[])     to service_role;
grant execute on function public.create_application(uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.move_application(uuid, uuid, uuid, text)              to service_role;
