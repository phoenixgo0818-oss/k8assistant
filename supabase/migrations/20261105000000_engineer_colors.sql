-- =============================================================================
-- K8assistant — a colour per engineer, so all of one person's cards stand out
-- =============================================================================

-- The palette lives here (for new engineers) and in src/lib/constants.ts (UI).
create function public.engineer_palette() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['#f43f5e','#f97316','#eab308','#84cc16','#10b981','#14b8a6',
               '#06b6d4','#3b82f6','#6366f1','#8b5cf6','#d946ef','#ec4899'];
$$;

alter table public.candidates
  add column color text not null default '#3b82f6'
  check (color ~ '^#[0-9a-f]{6}$');

-- Existing engineers: spread the palette by creation order
update public.candidates c
set color = (public.engineer_palette())[((n.rn - 1) % 12) + 1]
from (
  select id, row_number() over (partition by workspace_id order by created_at, name) as rn
  from public.candidates
) n
where n.id = c.id;

-- New engineers get the colour currently used by the fewest active engineers
create function public.next_engineer_color(p_workspace_id uuid) returns text
language sql stable
set search_path = ''
as $$
  select p.color
  from unnest(public.engineer_palette()) with ordinality as p(color, ord)
  left join public.candidates c
    on c.color = p.color and c.workspace_id = p_workspace_id and c.archived_at is null
  group by p.color, p.ord
  order by count(c.id), p.ord
  limit 1;
$$;

alter table public.candidates
  alter column color drop default;

create or replace function public.create_candidate(
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
  insert into public.candidates (workspace_id, name, headline, email, skills, color)
  values (p_workspace_id, trim(p_name), nullif(trim(p_headline), ''),
          nullif(trim(p_email), ''), coalesce(p_skills, '{}'),
          public.next_engineer_color(p_workspace_id))
  returning id into v_id;

  insert into public.activities (workspace_id, candidate_id, type, to_value)
  values (p_workspace_id, v_id, 'candidate_created', trim(p_name));

  return v_id;
end;
$$;

revoke execute on function public.next_engineer_color(uuid) from public, anon, authenticated;
grant  execute on function public.next_engineer_color(uuid) to service_role;
