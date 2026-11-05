-- =============================================================================
-- K8assistant — add and remove board columns (stages)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- New column. Goes just before the final columns (Hired / Rejected), so a
-- "rare case" stage sits with the other in-progress stages.
-- ---------------------------------------------------------------------------
create function public.create_stage(p_workspace_id uuid, p_name text, p_color text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_name  text := trim(p_name);
  v_order integer;
  v_id    uuid;
begin
  if v_name = '' then
    raise exception 'Column name is required';
  end if;
  if exists (select 1 from public.stages
             where workspace_id = p_workspace_id and lower(name) = lower(v_name)) then
    raise exception 'A column with this name already exists' using errcode = 'unique_violation';
  end if;

  -- Position: first final stage's slot, or the end if there is none
  select coalesce(
           (select min(sort_order) from public.stages where workspace_id = p_workspace_id and is_final),
           (select coalesce(max(sort_order), 0) + 1 from public.stages where workspace_id = p_workspace_id))
  into v_order;

  update public.stages
  set sort_order = sort_order + 1
  where workspace_id = p_workspace_id and sort_order >= v_order;

  insert into public.stages (workspace_id, name, color, sort_order, is_preset, is_final)
  values (p_workspace_id, v_name, p_color, v_order, false, false)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remove a column. Its cards (including hidden ones of archived engineers)
-- move to another column first; the app passes their new ranks in order.
-- Each moved card gets a "stage_changed" history entry.
-- ---------------------------------------------------------------------------
create function public.delete_stage(
  p_workspace_id    uuid,
  p_stage_id        uuid,
  p_target_stage_id uuid,
  p_application_ids uuid[],
  p_ranks           text[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from_name text;
  v_to_name   text;
  v_in_stage  integer;
begin
  select name into v_from_name from public.stages where id = p_stage_id and workspace_id = p_workspace_id;
  if v_from_name is null then
    raise exception 'Column not found';
  end if;
  if (select count(*) from public.stages where workspace_id = p_workspace_id) <= 1 then
    raise exception 'The board needs at least one column';
  end if;

  select count(*) into v_in_stage from public.applications where stage_id = p_stage_id;

  if v_in_stage > 0 then
    if p_target_stage_id is null or p_target_stage_id = p_stage_id then
      raise exception 'Choose another column for the cards';
    end if;
    select name into v_to_name from public.stages where id = p_target_stage_id and workspace_id = p_workspace_id;
    if v_to_name is null then
      raise exception 'Target column not found';
    end if;
    -- The app must account for every card in the column, with one rank each
    if coalesce(array_length(p_application_ids, 1), 0) <> v_in_stage
       or coalesce(array_length(p_ranks, 1), 0) <> v_in_stage
       or exists (select 1 from public.applications
                  where stage_id = p_stage_id and id <> all (p_application_ids)) then
      raise exception 'The column changed meanwhile, please try again';
    end if;

    insert into public.activities (workspace_id, candidate_id, application_id, type, from_value, to_value)
    select p_workspace_id, a.candidate_id, a.id, 'stage_changed', v_from_name, v_to_name
    from public.applications a
    where a.stage_id = p_stage_id;

    update public.applications a
    set stage_id = p_target_stage_id, rank = m.rank
    from unnest(p_application_ids, p_ranks) as m(id, rank)
    where a.id = m.id;
  end if;

  delete from public.stages where id = p_stage_id;
end;
$$;

revoke execute on function public.create_stage(uuid, text, text)                       from public, anon, authenticated;
revoke execute on function public.delete_stage(uuid, uuid, uuid, uuid[], text[])        from public, anon, authenticated;
grant  execute on function public.create_stage(uuid, text, text)                       to service_role;
grant  execute on function public.delete_stage(uuid, uuid, uuid, uuid[], text[])        to service_role;
