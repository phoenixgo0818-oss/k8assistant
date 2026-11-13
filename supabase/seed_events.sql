-- =============================================================================
-- K8assistant — demo events (FAKE DATA ONLY) for the board's "Upcoming" panel
--
-- Dates are relative to today (current_date + n), so the list always shows
-- upcoming events. Re-run it any time to move the demo events back into the
-- future; it replaces its own rows (matched by title) and touches nothing else:
--
--   npx supabase db query --linked -f supabase/seed_events.sql
--
-- Also runs after seed.sql on `supabase db reset` (see config.toml).
-- =============================================================================

-- One statement (a CTE chain), so it behaves the same in every SQL runner.
with demo_events (title, days, at, priority, candidate, company) as (values
  -- (title, days from today, time, priority, engineer, company — null = link to the engineer only)
  ('Prep call: Cobalt Pay tech round',          0, '09:30'::time, 'high', 'Alex Kim',      'Cobalt Pay'::text),
  ('Tech call with Cobalt Pay EM',              0, '15:00', 'high',   'Alex Kim',        'Cobalt Pay'),
  ('Chase Quill Media for panel feedback',      0, null,    'normal', 'Priya Nair',      'Quill Media'),
  ('Live coding: Orbit Logistics',              1, '11:00', 'high',   'Marco Rossi',     'Orbit Logistics'),
  ('Review Sofia''s CV before submitting',      1, null,    'normal', 'Sofia Mendes',    null),
  ('System design: Bluefin Systems',            2, '14:00', 'high',   'Daniel Okafor',   'Bluefin Systems'),
  ('Offer decision deadline: Northwind Labs',   2, '17:00', 'high',   'Alex Kim',        'Northwind Labs'),
  ('Final interview: Bluefin Systems',          3, '10:00', 'high',   'Wei Zhang',       'Bluefin Systems'),
  ('Debrief Wei after Bluefin final',           3, '16:30', 'normal', 'Wei Zhang',       'Bluefin Systems'),
  ('Take-home due: Ridge Analytics',            4, '18:00', 'normal', 'Emma Larsen',     'Ridge Analytics'),
  ('Tech call: Tandem Robotics',                6, '13:00', 'normal', 'Aisha Rahman',    'Tandem Robotics'),
  ('System design: Quill Media',                8, '15:30', 'normal', 'Lucía Fernández', 'Quill Media'),
  ('Negotiation call: Lumen Health offer',     10, '12:00', 'high',   'Ravi Patel',      'Lumen Health'),
  ('Monthly check-in with Hana',               13, null,    'low',    'Hana Sato',       null),
  -- One late item, to show what an unfinished event from an earlier day looks like
  ('Send Kofi the Orbit prep pack',            -1, null,    'normal', 'Kofi Mensah',     'Orbit Logistics')
),
-- Replace previous demo rows (same titles) so dates are fresh
removed as (
  delete from public.todos t using demo_events d where t.title = d.title
)
insert into public.todos (workspace_id, title, due_date, due_time, priority, candidate_id, application_id)
select
  '00000000-0000-0000-0000-000000000001',
  d.title,
  current_date + d.days,
  d.at,
  d.priority,
  case when d.company is null then cand.id end,   -- engineer-only events link the engineer
  app.id                                          -- process events link the process
from demo_events d
join public.candidates cand on cand.name = d.candidate
left join public.companies comp on comp.name = d.company
left join public.applications app on app.candidate_id = cand.id and app.company_id = comp.id;
