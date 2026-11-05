-- =============================================================================
-- K8assistant — Phase 2.5: edit / reorder columns, edit / delete labels
-- =============================================================================

-- Names are unique regardless of capitals ("Offer" vs "offer"), like companies
alter table public.stages drop constraint stages_workspace_id_name_key;
create unique index stages_workspace_lower_name_key on public.stages (workspace_id, lower(name));
alter table public.labels drop constraint labels_workspace_id_name_key;
create unique index labels_workspace_lower_name_key on public.labels (workspace_id, lower(name));

-- ---------------------------------------------------------------------------
-- Move a column one step left (-1) or right (+1): swap with its neighbour
-- ---------------------------------------------------------------------------
create function public.move_stage(p_workspace_id uuid, p_stage_id uuid, p_direction integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order    integer;
  v_other_id uuid;
  v_other    integer;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1';
  end if;

  select sort_order into v_order
  from public.stages where id = p_stage_id and workspace_id = p_workspace_id
  for update;
  if v_order is null then
    raise exception 'Column not found';
  end if;

  select id, sort_order into v_other_id, v_other
  from public.stages
  where workspace_id = p_workspace_id
    and case when p_direction < 0 then sort_order < v_order else sort_order > v_order end
  order by case when p_direction < 0 then -sort_order else sort_order end
  limit 1
  for update;

  if v_other_id is null then
    return; -- already first / last
  end if;

  update public.stages set sort_order = v_other where id = p_stage_id;
  update public.stages set sort_order = v_order where id = v_other_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete a label: every card that had it gets a "label_removed" history entry
-- ---------------------------------------------------------------------------
create function public.delete_label(p_workspace_id uuid, p_label_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_name  text;
  v_count integer;
begin
  select name into v_name from public.labels where id = p_label_id and workspace_id = p_workspace_id;
  if v_name is null then
    raise exception 'Label not found';
  end if;

  insert into public.activities (workspace_id, candidate_id, application_id, type, to_value)
  select p_workspace_id, a.candidate_id, a.id, 'label_removed', v_name
  from public.application_labels al
  join public.applications a on a.id = al.application_id
  where al.label_id = p_label_id;
  get diagnostics v_count = row_count;

  delete from public.labels where id = p_label_id;  -- application_labels cascade
  return v_count;
end;
$$;

revoke execute on function public.move_stage(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.delete_label(uuid, uuid)        from public, anon, authenticated;
grant  execute on function public.move_stage(uuid, uuid, integer) to service_role;
grant  execute on function public.delete_label(uuid, uuid)        to service_role;
