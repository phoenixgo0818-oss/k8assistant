-- =============================================================================
-- K8assistant — seed data (FAKE DATA ONLY — never put real people here)
--
-- Runs after migrations on `supabase db reset` / `db push --include-seed`.
-- Lookups go by name so the file stays readable; ids are generated.
-- =============================================================================

-- Default workspace (fixed id so the app can reference it until Phase 5)
insert into public.workspaces (id, name)
values ('00000000-0000-0000-0000-000000000001', 'My workspace');

-- ---------------------------------------------------------------------------
-- Preset stages and labels
--
-- TODO(human): adjust these to YOUR real process. Rename, add, remove, or
-- reorder rows (sort_order), and mark which stages are final. This is the
-- "write down your real stages and labels" task from PLAN.md §9.
-- ---------------------------------------------------------------------------
insert into public.stages (workspace_id, name, color, sort_order, is_preset, is_final)
select '00000000-0000-0000-0000-000000000001', name, color, sort_order, true, is_final
from (values
  ('New',             '#64748b', 1, false),
  ('Screening',       '#0ea5e9', 2, false),
  ('Tech Call',       '#6366f1', 3, false),
  ('Live Coding',     '#8b5cf6', 4, false),
  ('System Design',   '#a855f7', 5, false),
  ('Final Interview', '#ec4899', 6, false),
  ('Offer',           '#f59e0b', 7, false),
  ('Hired',           '#10b981', 8, true),
  ('Rejected',        '#ef4444', 9, true)
) as s(name, color, sort_order, is_final);

insert into public.labels (workspace_id, name, color, is_preset)
select '00000000-0000-0000-0000-000000000001', name, color, true
from (values
  ('Awaiting reply', '#f59e0b'),
  ('Scheduled',      '#0ea5e9'),
  ('Needs feedback', '#8b5cf6'),
  ('On hold',        '#64748b')
) as l(name, color);

-- A custom (non-preset) label, to prove both kinds work the same way
insert into public.labels (workspace_id, name, color, is_preset)
values ('00000000-0000-0000-0000-000000000001', 'Waiting assessment', '#14b8a6', false);

-- ---------------------------------------------------------------------------
-- Companies (fictional)
-- ---------------------------------------------------------------------------
insert into public.companies (workspace_id, name, website, context)
select '00000000-0000-0000-0000-000000000001', name, website, context
from (values
  ('Northwind Labs',   'https://northwind.example.com', 'Series B, fintech infra. Fast process (2 weeks).'),
  ('Bluefin Systems',  'https://bluefin.example.com',   'Large enterprise. Long loops, strong system design bar.'),
  ('Cobalt Pay',       'https://cobalt.example.com',    'Payments startup. Remote-first, Go shop.'),
  ('Lumen Health',     'https://lumen.example.com',     'Healthtech. Requires on-site 2 days a week.'),
  ('Orbit Logistics',  'https://orbit.example.com',     'Data-heavy; hires many data engineers.'),
  ('Quill Media',      'https://quill.example.com',     'Frontend-focused, React + TypeScript.'),
  ('Ridge Analytics',  'https://ridge.example.com',     'Take-home assessment for every role.'),
  ('Tandem Robotics',  'https://tandem.example.com',    'Embedded + cloud. Visa sponsorship available.')
) as c(name, website, context);

-- ---------------------------------------------------------------------------
-- Candidates: 15 fictional engineers
-- ---------------------------------------------------------------------------
insert into public.candidates
  (workspace_id, name, headline, years_experience, email, links, skills, source, context)
select '00000000-0000-0000-0000-000000000001', name, headline, yrs,
       lower(replace(name, ' ', '.')) || '@example.com', links, skills, source, context
from (values
  ('Alex Kim',       'Backend engineer',        5,  array['https://github.com/example-alex'],   array['Go','Postgres','Kafka'],          'Referral', 'Prefers remote. Open to fintech.'),
  ('Priya Nair',     'Full-stack engineer',     7,  array['https://linkedin.com/in/example-priya'], array['TypeScript','React','Node.js'], 'LinkedIn', 'Wants a lead role within a year.'),
  ('Marco Rossi',    'Data engineer',           4,  array[]::text[],                            array['Python','Spark','Airflow'],       'Referral', null),
  ('Sofia Mendes',   'Frontend engineer',       3,  array['https://github.com/example-sofia'],  array['React','TypeScript','CSS'],       'Meetup',   'Strong design sense.'),
  ('Daniel Okafor',  'Platform engineer',       9,  array[]::text[],                            array['Kubernetes','Terraform','AWS'],   'LinkedIn', 'Notice period: 3 months.'),
  ('Hana Sato',      'Mobile engineer',         6,  array[]::text[],                            array['Swift','Kotlin','React Native'],  'Referral', null),
  ('Liam Walsh',     'Backend engineer',        2,  array['https://github.com/example-liam'],   array['Java','Spring','MySQL'],          'Job board','Junior, learning fast.'),
  ('Aisha Rahman',   'ML engineer',             5,  array[]::text[],                            array['Python','PyTorch','MLOps'],       'Conference', 'Needs visa sponsorship.'),
  ('Tomás García',   'SRE',                     8,  array[]::text[],                            array['Linux','Prometheus','Go'],        'Referral', null),
  ('Emma Larsen',    'Full-stack engineer',     4,  array[]::text[],                            array['Ruby','Rails','React'],           'LinkedIn', 'Prefers small teams.'),
  ('Wei Zhang',      'Backend engineer',        10, array['https://github.com/example-wei'],    array['Rust','Postgres','gRPC'],         'Referral', 'Senior; expects staff-level offers.'),
  ('Nadia Petrova',  'QA automation engineer',  6,  array[]::text[],                            array['Playwright','TypeScript','CI'],   'Job board', null),
  ('Kofi Mensah',    'Data engineer',           3,  array[]::text[],                            array['SQL','dbt','Snowflake'],          'Meetup',   null),
  ('Lucía Fernández','Frontend engineer',       5,  array[]::text[],                            array['Vue','TypeScript','Accessibility'],'LinkedIn','Part-time until March.'),
  ('Ravi Patel',     'Security engineer',       7,  array[]::text[],                            array['AppSec','Go','Threat modeling'],  'Referral', null)
) as c(name, headline, yrs, links, skills, source, context);

-- ---------------------------------------------------------------------------
-- Applications: ~25 processes. Several engineers are in more than one.
-- rank = fractional-index key per stage column: 'a0', 'a1', ... (base-62 digit)
-- ---------------------------------------------------------------------------
insert into public.applications (workspace_id, candidate_id, company_id, role, stage_id, rank)
select '00000000-0000-0000-0000-000000000001', cand.id, comp.id, v.role, st.id,
       'a' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                     (row_number() over (partition by v.stage order by v.ord))::int, 1)
from (values
  ( 1, 'Alex Kim',        'Cobalt Pay',       'Senior Backend Engineer',  'Tech Call'),
  ( 2, 'Alex Kim',        'Northwind Labs',   'Backend Engineer',         'Offer'),
  ( 3, 'Alex Kim',        'Bluefin Systems',  'Platform Engineer',        'New'),
  ( 4, 'Priya Nair',      'Quill Media',      'Lead Full-stack Engineer', 'Final Interview'),
  ( 5, 'Priya Nair',      'Northwind Labs',   'Full-stack Engineer',      'Screening'),
  ( 6, 'Marco Rossi',     'Orbit Logistics',  'Data Engineer',            'Live Coding'),
  ( 7, 'Marco Rossi',     'Ridge Analytics',  'Analytics Engineer',       'Rejected'),
  ( 8, 'Sofia Mendes',    'Quill Media',      'Frontend Engineer',        'Tech Call'),
  ( 9, 'Daniel Okafor',   'Bluefin Systems',  'Staff Platform Engineer',  'System Design'),
  (10, 'Daniel Okafor',   'Tandem Robotics',  'Cloud Platform Engineer',  'Screening'),
  (11, 'Hana Sato',       'Lumen Health',     'Mobile Engineer',          'New'),
  (12, 'Liam Walsh',      'Cobalt Pay',       'Junior Backend Engineer',  'Screening'),
  (13, 'Aisha Rahman',    'Tandem Robotics',  'ML Engineer',              'Tech Call'),
  (14, 'Aisha Rahman',    'Lumen Health',     'ML Engineer',              'Rejected'),
  (15, 'Tomás García',    'Northwind Labs',   'SRE',                      'Hired'),
  (16, 'Emma Larsen',     'Ridge Analytics',  'Full-stack Engineer',      'Live Coding'),
  (17, 'Wei Zhang',       'Bluefin Systems',  'Staff Backend Engineer',   'Final Interview'),
  (18, 'Wei Zhang',       'Cobalt Pay',       'Principal Engineer',       'Tech Call'),
  (19, 'Wei Zhang',       'Orbit Logistics',  'Staff Engineer',           'New'),
  (20, 'Nadia Petrova',   'Quill Media',      'QA Automation Engineer',   'Screening'),
  (21, 'Kofi Mensah',     'Orbit Logistics',  'Data Engineer',            'Tech Call'),
  (22, 'Kofi Mensah',     'Ridge Analytics',  'Data Engineer',            'New'),
  (23, 'Lucía Fernández', 'Quill Media',      'Senior Frontend Engineer', 'System Design'),
  (24, 'Ravi Patel',      'Bluefin Systems',  'Security Engineer',        'Live Coding'),
  (25, 'Ravi Patel',      'Lumen Health',     'AppSec Engineer',          'Offer')
) as v(ord, candidate, company, role, stage)
join public.candidates cand on cand.name = v.candidate
join public.companies  comp on comp.name = v.company
join public.stages     st   on st.name   = v.stage;

-- Helper view of applications by (candidate, company), used by the inserts below
create temporary view seed_apps as
select a.id, a.candidate_id, a.stage_id, cand.name as candidate, comp.name as company
from public.applications a
join public.candidates cand on cand.id = a.candidate_id
join public.companies  comp on comp.id = a.company_id;

-- ---------------------------------------------------------------------------
-- Labels on cards
-- ---------------------------------------------------------------------------
insert into public.application_labels (workspace_id, application_id, label_id)
select '00000000-0000-0000-0000-000000000001', sa.id, l.id
from (values
  ('Alex Kim',        'Cobalt Pay',      'Scheduled'),
  ('Alex Kim',        'Northwind Labs',  'Awaiting reply'),
  ('Priya Nair',      'Quill Media',     'Needs feedback'),
  ('Marco Rossi',     'Orbit Logistics', 'Scheduled'),
  ('Emma Larsen',     'Ridge Analytics', 'Waiting assessment'),
  ('Kofi Mensah',     'Ridge Analytics', 'Waiting assessment'),
  ('Kofi Mensah',     'Ridge Analytics', 'Awaiting reply'),
  ('Daniel Okafor',   'Tandem Robotics', 'On hold'),
  ('Wei Zhang',       'Bluefin Systems', 'Needs feedback'),
  ('Wei Zhang',       'Cobalt Pay',      'Scheduled'),
  ('Aisha Rahman',    'Tandem Robotics', 'Awaiting reply'),
  ('Ravi Patel',      'Lumen Health',    'Awaiting reply'),
  ('Lucía Fernández', 'Quill Media',     'Scheduled')
) as v(candidate, company, label)
join seed_apps sa on sa.candidate = v.candidate and sa.company = v.company
join public.labels l on l.name = v.label;

-- ---------------------------------------------------------------------------
-- Notes (stage at the time = the card's current stage for this seed)
-- ---------------------------------------------------------------------------
insert into public.application_notes (workspace_id, application_id, stage_id, body)
select '00000000-0000-0000-0000-000000000001', sa.id, sa.stage_id, v.body
from (values
  ('Alex Kim',   'Northwind Labs',  'Offer: base within range. Alex wants 2 days to decide.'),
  ('Alex Kim',   'Cobalt Pay',      'Tech call booked with their EM for Thursday.'),
  ('Priya Nair', 'Quill Media',     'Final round went well; waiting on panel feedback.'),
  ('Wei Zhang',  'Bluefin Systems', 'Strong system design round. Asked about staff scope.'),
  ('Marco Rossi','Ridge Analytics', 'Rejected after take-home: wanted more dbt experience.')
) as v(candidate, company, body)
join seed_apps sa on sa.candidate = v.candidate and sa.company = v.company;

-- ---------------------------------------------------------------------------
-- Activity: every application starts with an "application_created" event
-- ---------------------------------------------------------------------------
insert into public.activities (workspace_id, candidate_id, application_id, type, to_value)
select '00000000-0000-0000-0000-000000000001', sa.candidate_id, sa.id, 'application_created', sa.company
from seed_apps sa;

drop view seed_apps;
