-- =============================================================================
-- K8assistant — removing engineers / processes, editable notes, companies
-- =============================================================================

-- Two new history types: restoring an archived engineer, deleting a process
alter table public.activities drop constraint activities_type_check;
alter table public.activities add constraint activities_type_check check (type in (
  'candidate_created', 'candidate_updated', 'candidate_archived', 'candidate_restored',
  'application_created', 'stage_changed',
  'label_added', 'label_removed', 'application_archived', 'application_deleted'
));

-- ---------------------------------------------------------------------------
-- Archive / restore an engineer: hidden from the board and lists, nothing lost
-- ---------------------------------------------------------------------------
create function public.set_candidate_archived(
  p_workspace_id uuid,
  p_candidate_id uuid,
  p_archived     boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_changed integer;
begin
  update public.candidates
  set archived_at = case when p_archived then now() else null end
  where id = p_candidate_id
    and workspace_id = p_workspace_id
    and (archived_at is null) = p_archived;   -- only if it actually changes
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into public.activities (workspace_id, candidate_id, type)
    values (p_workspace_id, p_candidate_id,
            case when p_archived then 'candidate_archived' else 'candidate_restored' end);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete one process (card). Its notes, labels and card history go with it
-- (ON DELETE CASCADE); a line stays in the engineer's profile history.
-- ---------------------------------------------------------------------------
create function public.delete_application(p_workspace_id uuid, p_application_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_candidate_id uuid;
  v_what         text;
begin
  select a.candidate_id, c.name || ' · ' || a.role
  into v_candidate_id, v_what
  from public.applications a
  join public.companies c on c.id = a.company_id
  where a.id = p_application_id and a.workspace_id = p_workspace_id;

  if v_candidate_id is null then
    raise exception 'Application not found';
  end if;

  delete from public.applications where id = p_application_id;

  insert into public.activities (workspace_id, candidate_id, type, from_value)
  values (p_workspace_id, v_candidate_id, 'application_deleted', v_what);
end;
$$;

revoke execute on function public.set_candidate_archived(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.delete_application(uuid, uuid)              from public, anon, authenticated;
grant  execute on function public.set_candidate_archived(uuid, uuid, boolean) to service_role;
grant  execute on function public.delete_application(uuid, uuid)              to service_role;

-- Company names are compared case-insensitively everywhere (find_or_create_company);
-- enforce it in the table too, so "Acme" and "acme" can't both exist.
alter table public.companies drop constraint companies_workspace_id_name_key;
create unique index companies_workspace_lower_name_key on public.companies (workspace_id, lower(name));
