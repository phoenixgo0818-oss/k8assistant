-- =============================================================================
-- K8assistant — Phase 2.4: detail panel writes
-- Same pattern as 2.3: one function = one transaction = change + its history.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Label on / off for one card (+ label_added / label_removed activity)
-- ---------------------------------------------------------------------------
create function public.set_application_label(
  p_workspace_id   uuid,
  p_application_id uuid,
  p_label_id       uuid,
  p_on             boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_candidate_id uuid;
  v_label_name   text;
  v_changed      integer;
begin
  select candidate_id into v_candidate_id
  from public.applications
  where id = p_application_id and workspace_id = p_workspace_id;
  if v_candidate_id is null then
    raise exception 'Application not found';
  end if;

  select name into v_label_name
  from public.labels where id = p_label_id and workspace_id = p_workspace_id;
  if v_label_name is null then
    raise exception 'Label not found';
  end if;

  if p_on then
    insert into public.application_labels (workspace_id, application_id, label_id)
    values (p_workspace_id, p_application_id, p_label_id)
    on conflict do nothing;        -- already on: nothing to do, nothing to log
  else
    delete from public.application_labels
    where application_id = p_application_id and label_id = p_label_id;
  end if;

  get diagnostics v_changed = row_count;
  if v_changed > 0 then
    insert into public.activities (workspace_id, candidate_id, application_id, type, to_value)
    values (p_workspace_id, v_candidate_id, p_application_id,
            case when p_on then 'label_added' else 'label_removed' end, v_label_name);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create a label (or return the existing one with the same name)
-- ---------------------------------------------------------------------------
create function public.create_label(p_workspace_id uuid, p_name text, p_color text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_name text := trim(p_name);
  v_id   uuid;
begin
  if v_name = '' then
    raise exception 'Label name is required';
  end if;

  select id into v_id
  from public.labels
  where workspace_id = p_workspace_id and lower(name) = lower(v_name);

  if v_id is null then
    insert into public.labels (workspace_id, name, color)
    values (p_workspace_id, v_name, p_color)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Note on a card, stamped with the card's CURRENT stage
-- ---------------------------------------------------------------------------
create function public.add_application_note(
  p_workspace_id   uuid,
  p_application_id uuid,
  p_body           text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_stage_id uuid;
  v_id       uuid;
begin
  select stage_id into v_stage_id
  from public.applications
  where id = p_application_id and workspace_id = p_workspace_id;
  if v_stage_id is null then
    raise exception 'Application not found';
  end if;

  insert into public.application_notes (workspace_id, application_id, stage_id, body)
  values (p_workspace_id, p_application_id, v_stage_id, trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Edit an engineer's profile. Logs one "candidate_updated" row per field that
-- actually changed (IS DISTINCT FROM treats NULL = NULL as "same").
-- Long free text (context) is logged as "edited" without copying the text.
-- ---------------------------------------------------------------------------
create function public.update_candidate(
  p_workspace_id     uuid,
  p_candidate_id     uuid,
  p_name             text,
  p_headline         text,
  p_years_experience integer,
  p_email            text,
  p_phone            text,
  p_links            text[],
  p_skills           text[],
  p_source           text,
  p_context          text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  o public.candidates%rowtype;
  n public.candidates%rowtype;
begin
  select * into o
  from public.candidates
  where id = p_candidate_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'Candidate not found';
  end if;

  update public.candidates set
    name             = trim(p_name),
    headline         = nullif(trim(p_headline), ''),
    years_experience = p_years_experience,
    email            = nullif(trim(p_email), ''),
    phone            = nullif(trim(p_phone), ''),
    links            = coalesce(p_links, '{}'),
    skills           = coalesce(p_skills, '{}'),
    source           = nullif(trim(p_source), ''),
    context          = nullif(trim(p_context), '')
  where id = p_candidate_id
  returning * into n;

  insert into public.activities (workspace_id, candidate_id, type, field, from_value, to_value)
  select p_workspace_id, p_candidate_id, 'candidate_updated', f.field, f.old_v, f.new_v
  from (values
    ('name',             o.name,                          n.name),
    ('headline',         o.headline,                      n.headline),
    ('years_experience', o.years_experience::text,        n.years_experience::text),
    ('email',            o.email,                         n.email),
    ('phone',            o.phone,                         n.phone),
    ('links',            array_to_string(o.links, ', '),  array_to_string(n.links, ', ')),
    ('skills',           array_to_string(o.skills, ', '), array_to_string(n.skills, ', ')),
    ('source',           o.source,                        n.source),
    ('context',          null::text, case when o.context is distinct from n.context then 'edited' end)
  ) as f(field, old_v, new_v)
  where f.old_v is distinct from f.new_v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Server-only, like the 2.3 functions
-- ---------------------------------------------------------------------------
revoke execute on function public.set_application_label(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.create_label(uuid, text, text)                   from public, anon, authenticated;
revoke execute on function public.add_application_note(uuid, uuid, text)           from public, anon, authenticated;
revoke execute on function public.update_candidate(uuid, uuid, text, text, integer, text, text, text[], text[], text, text) from public, anon, authenticated;

grant execute on function public.set_application_label(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.create_label(uuid, text, text)                   to service_role;
grant execute on function public.add_application_note(uuid, uuid, text)           to service_role;
grant execute on function public.update_candidate(uuid, uuid, text, text, integer, text, text, text[], text[], text, text) to service_role;
