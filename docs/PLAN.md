# SWE Hub — Project Plan

Oct 26, 2026 · @Money

## 1. Overview and goals

**SWE Hub** (working name) is a web app for managing the SWE team's hiring and day-to-day work. Version 1 is a Jira-style **Hiring Board**: every engineer candidate gets a profile card, and cards move across interview stages. Later versions add **Daily To-do**, **Notes**, and **multi-user** support.

Learning happens by **building the app itself**, not through a separate learning feature. Technologies that come up in team meetings, such as queues (RabbitMQ), CI/CD, Docker, and Redis, are used for real features of this app.

Goals:

1. **Usage** — See every candidate, their current stage, and what is pending, on one board.
2. **Learning by building** — Go through the whole SWE lifecycle yourself: planning, design, coding, testing, deployment, and operations.
3. **Team** — Start as a single-user tool, then grow into a tool the team uses together.

Principles:

- Start every service on its **free tier** (section 4).
- Use **fake data** while learning. Real candidate data comes only after security setup and company approval (section 8).
- **CI/CD from day one**: every change goes PR → automated checks → automated deploy.
- **Queue for real automation**: events such as stage changes go through a queue to create follow-up to-dos and notifications (section 4).
- Build small, deploy often, use it yourself, improve (**iterative development**).
- Don't force technology the app doesn't need (e.g., Kubernetes) into production code; try it in the Infra Lab instead. Judging "do we need this at our scale?" is a skill too.

## 2. Version 1: Hiring Board

Version 1 is a Kanban board where each **profile** (one engineer candidate) is a card. Columns are **stages**: where the candidate is in the process. Chips on a card are **labels**: what is happening right now. Both come with presets, and you can add your own at any time.

&#91;embedded content: hiring board · v1 mockup\]

### Stages and labels

Stages and labels are separate on purpose. A stage answers "where are they?", and a card has exactly one. Labels answer "what are we waiting for?", and a card can have several. Keeping them apart makes filters like "everyone waiting on an assessment" possible.

| Type | Presets | Custom examples | Rules |
| --- | --- | --- | --- |
| **Stage** (column) | New, Screening, Tech Call, Live Coding, System Design, Final Interview, Offer, Hired, Rejected | Take-home Review, Culture Fit | Exactly one per profile. Add, rename, reorder, recolor. Hired and Rejected are final stages |
| **Label** (chip) | Awaiting reply, Scheduled, Needs feedback, On hold | Waiting assessment, Referral, Visa needed | Zero or more per profile. Add, rename, recolor, delete |

### Profile fields

You can register a profile at any time with the **+ New profile** button. Only the name is required, so you can add someone in seconds and fill in the rest later. A new profile lands in the **New** column unless you pick another stage, and every profile always appears on the board.

| Field | Type | Required | Example |
| --- | --- | --- | --- |
| Name | text | yes | Alex Kim |
| Role | text | no | Backend engineer |
| Years of experience | number | no | 5 |
| Email, phone | text | no | alex@example.com |
| Links | list of URLs | no | GitHub, LinkedIn, CV |
| Skills | tags | no | Go, Postgres, Kafka |
| Source | text | no | Referral, LinkedIn |
| Context | long text | no | Referred by a teammate; prefers remote |

### Card detail panel

Clicking a card opens a side panel, like opening an issue in Jira.

- Edit every profile field inline. The **Context** box holds background that rarely changes.
- Change the stage from a dropdown; this does the same as dragging the card.
- Add or remove labels, or create a new label on the spot.
- **Notes**: a text input with an **Add** button. Each note is saved with a timestamp and the stage at that moment, for interview feedback and call summaries.
- **Activity**: an automatic history of stage moves, label changes, and edits, newest first.

### Board behaviour

- Drag and drop cards between columns and within a column; the order is saved.
- Each column header shows its card count.
- Search by name or skill; filter by label and role.
- Hired and Rejected columns can be collapsed. In v1, profiles are archived, never hard-deleted.

### Acceptance criteria for v1

- [ ] I can register a profile with only a name, and it appears in New immediately
- [ ] I can drag a card to another column, and it stays there after a page refresh
- [ ] I can create a custom stage and a custom label and use them right away
- [ ] I can add a note to a profile, and it shows up with its timestamp and stage
- [ ] Every stage and label change appears in the profile's activity history
- [ ] I can filter the board to show only cards with a given label
- [ ] Every PR runs lint, type check, and tests in GitHub Actions before merge

Out of scope for v1: sign-in, multiple users, email integration, and file uploads (CVs stay as links).

## 3. Modules after v1

Each later module connects to the board: stage and label changes can create to-dos, and notes can link to profiles.

| Module | Problem it solves | Main features | Phase |
| --- | --- | --- | --- |
| **Daily To-do** | Daily tasks get scattered and missed | Today's list, due dates, priority, automatic carry-over of unfinished items, follow-up to-dos generated from the board | 2 |
| **Notes** | Context and decisions on long-term work get lost | Markdown notes, tags, pinning, links to profiles and to-dos, search | 2 |
| **Team** | A personal tool becomes a team tool | Sign-in, workspaces, roles (Admin / Member / Viewer), card assignees, comments | 5 |

## 4. Tech stack and architecture

Everything below starts free and is widely used in industry. The queue (RabbitMQ) and CI/CD (GitHub Actions) are real parts of the app, not side exercises. Free-tier limits were checked in October 2026 and change often, so re-check before signing up.

| Layer | Tool | Free tier and conditions | What you learn |
| --- | --- | --- | --- |
| Frontend + API | **Next.js** (App Router) + **TypeScript** + **Tailwind CSS** | Open source | React, components, state, server actions, API routes |
| Board UI | A component kit (e.g. shadcn/ui) + a drag-and-drop library (e.g. dnd-kit) | Open source | component libraries, drag and drop, accessibility |
| Database + Auth | [**Supabase**](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/) (PostgreSQL) | 2 active projects, 500 MB database, 1 GB files, 50,000 MAU. Pauses after 7 idle days; no automatic backups | SQL, schema, migrations, transactions, authentication, RLS |
| Hosting | [**Vercel** Hobby](https://vercel.com/docs/plans/hobby) | 1,000,000 function invocations/month, 100 deploys/day. **Personal, non-commercial use only** | deploys, environment variables, preview deploys, serverless |
| CI/CD + scheduler | [**GitHub** + **GitHub Actions**](https://cicdcalculator.com/github-actions-free-tier) | Unlimited for public repos; 2,000 minutes/month for private repos | Git, PRs, CI/CD, YAML workflows, service containers, scheduled workflows |
| Message queue | [**CloudAMQP** Little Lemur](https://www.cloudamqp.com/plans/) (RabbitMQ) | 1M messages/month, 20 connections, 100 queues, webhooks (push queues). Deleted after 2 months without messages | message broker, exchange, producer/consumer, retries, dead-letter queue |
| Local dev | **Docker** + **docker-compose** | Runs Postgres, RabbitMQ, and the worker locally. Docker Desktop may need a paid license depending on company size | containers, images, volumes |
| Cache | [**Upstash Redis**](https://upstash.com/pricing/redis) | 1 database, 250 MB, 500K commands/month, 10 GB bandwidth/month | cache, TTL, rate limiting |
| AI (later) | [**Gemini API** free tier](https://yingtu.ai/en/blog/google-gemini-api-free-tier-limits-2026) | Flash, Flash-Lite, and embedding models free with rate limits. Free-tier input is used to improve Google products | LLMs, prompts, embeddings, RAG |
| Infra Lab | **kind** (local Kubernetes), **Terraform** | Open source, runs on your computer | Kubernetes, IaC |

Two things to know now. Vercel Hobby is for personal, non-commercial use: fine while you learn alone, but hosting must be re-decided before the team uses the app for work (the **Team rollout gate** in section 6). Supabase free projects pause after a week of inactivity and have no backups, so automating backups yourself is part of the plan.

### How the queue and CI/CD fit into the app

Code changes flow through the CI/CD pipeline, and business events flow through the queue. Both power real features.

&#91;embedded content: architecture · CI/CD pipeline + event queue\]

- **CI/CD** — Every change arrives as a PR. GitHub Actions runs lint, type check, and tests; integration tests start Postgres and RabbitMQ as **service containers**, so they run against real dependencies. Passing PRs get a preview URL, and merging to main runs DB migrations and then deploys to production.
- **Queue** — When a profile changes stage or label, the app saves the change and a `profile.stage_changed` event in the same transaction (outbox), then publishes the event to RabbitMQ. Three consumers split the work: creating follow-up to-dos, writing the activity history, and sending notifications. Messages that still fail after retries go to a dead-letter queue for inspection.
- **Scheduler** — A scheduled GitHub Actions workflow publishes a daily event every morning. It carries over unfinished to-dos and creates follow-ups for candidates past their reply deadline, so the CI/CD tool doubles as the app's scheduler.
- **Where consumers run** — Locally, a Node.js worker in docker-compose subscribes to the queue. Vercel has no always-on server, so Phase 4 tests CloudAMQP's webhook (push queue) feature to deliver messages to a Vercel API route. If that doesn't work as expected, compare free hosting for an always-on worker at that point.
- **Sync first, async later** — In Phase 1 the activity history is written directly in the same request. Phase 4 moves that work to a consumer. Refactoring working code from synchronous to event-driven is a lesson in itself.

## 5. Data model

The data grows to 16 PostgreSQL tables, 7 of them in Phase 1. Every table has a `workspace_id` from Phase 1 with a single default workspace, so moving to multiple users in Phase 5 needs no data migration (**multi-tenancy**). Names follow the usual snake\_case convention.

| Table | Key columns | Purpose | Phase |
| --- | --- | --- | --- |
| `workspaces` | name | Team unit; only one at first | 1 |
| `stages` | name, color, sort\_order, is\_preset, is\_final | Board columns, preset and custom | 1 |
| `labels` | name, color, is\_preset | Card labels, preset and custom | 1 |
| `candidates` | name, role, years\_experience, email, phone, links, skills, source, context, stage\_id, rank, archived\_at | One profile = one card | 1 |
| `candidate_labels` | candidate\_id, label\_id | Which labels each card has | 1 |
| `candidate_notes` | candidate\_id, body, stage\_id, created\_at | Notes added from the detail panel | 1 |
| `activities` | candidate\_id, type, from\_value, to\_value, created\_at | Automatic history: stage moves, label changes, edits | 1 |
| `todos` | title, due\_date, priority, done, source (manual / auto), candidate\_id | Daily To-do; auto-created items have source = auto | 2 |
| `notes` | title, body (Markdown), tags, pinned | Long-term work notes | 2 |
| `note_links` | note\_id, candidate\_id, todo\_id | Links notes to profiles and to-dos | 2 |
| `user_profiles` | user\_id, display\_name | Signed-in app users (separate from candidate profiles) | 3 |
| `events` | type, payload, status, created\_at | Events waiting to be published to the queue (transactional outbox) | 4 |
| `processed_messages` | message\_id, consumer, processed\_at | Stops the same message from being handled twice | 4 |
| `notifications` | user\_id, body, read\_at | In-app notifications | 4 |
| `memberships` | user\_id, workspace\_id, role | Team members and roles | 5 |
| `comments` | candidate\_id, author\_id, body | Team comments on profiles | 5 |

Design points worth learning:

- In the UI a card is a "profile", but the table is `candidates`, so it doesn't clash with `user_profiles` for app users. Naming things clearly is part of the job.
- A profile has one stage (`stage_id`, **one-to-many**) but many labels (`candidate_labels`, **many-to-many**). This is the stage/label split from section 2, expressed in the schema.
- `rank` stores a card's order within its column. Moving a card should update one row, not renumber the whole column; ask Claude Code about **fractional indexing**.
- Presets are seeded rows with `is_preset = true`, so presets and custom stages and labels share one code path.
- `events` uses the **transactional outbox** pattern: the stage change and the event are saved in one DB transaction before publishing, so a crash can't lose the event.
- Queues can deliver a message more than once (**at-least-once delivery**). `processed_messages` filters duplicates, so follow-up to-dos aren't created twice (**idempotency**).
- v1 keeps one card per candidate. If someone applies for two roles, you can later split `candidates` into candidates and applications, which is a real-world schema migration to practise.

## 6. Roadmap

The roadmap runs Core (Phase 0–5) → Team rollout gate → Ops (Phase 6) → Afterward (Phase 7–12). CI/CD arrives in Phase 0 and the queue in Phase 4, both as real features. At 5–8 hours a week, expect roughly 1–3 weeks per phase, but passing each completion check yourself matters more than speed.

&#91;embedded content: roadmap · 13 phases, 1 gate\]

Do Core in order, and pick Afterward phases by need. Each phase's details and completion check are below; update the Status column as you go.

| Phase | What you build (usage) | What you learn | Done when | Status |
| --- | --- | --- | --- | --- |
| **0. Setup + CI/CD** | Next.js project, GitHub repo, Vercel deploy, GitHub Actions running lint and build on every PR | Git, branches, PRs, CLI, Node.js, CI, CD, YAML | Opening a PR runs checks automatically, and merging to main deploys | Not started |
| **1. Hiring Board v1** | The board from section 2: preset and custom stages and labels, + New profile, drag and drop, detail panel with notes and activity | React, components, state, SQL, schema, migrations, seed data, CRUD, server actions, drag and drop | Every v1 acceptance criterion in section 2 passes with 15 fake profiles | Not started |
| **2. Daily To-do + Notes** | Today's list, carry-over, priority; Markdown notes, tags, links to profiles | foreign keys, relations, full-text search, Markdown rendering | You manage a week of your own work tasks and notes only in the app | Not started |
| **3. Auth + Testing** | Google sign-in, RLS, unit and E2E tests in CI | authentication vs authorization, OAuth, JWT, RLS, unit tests, E2E tests, branch protection | A failing test blocks the merge | Not started |
| **4. Queue automation** | Stage and label events → RabbitMQ → follow-up to-dos, activity history, in-app notifications. docker-compose locally; a RabbitMQ container in CI integration tests | Docker, docker-compose, message broker, exchange, producer/consumer, retries, dead-letter queue, outbox, idempotency | Adding the "Waiting assessment" label creates a follow-up to-do due in N days, and no message is lost while the consumer is down | Not started |
| **5. Multi-user** | Workspace invites, roles, card assignees, comments; separate staging and production | RBAC, multi-tenancy, environments, secrets management | A teammate you invite works on the same board (fake data) | Not started |
| **Team rollout gate** | Hosting decision, privacy review, approval for real data | data privacy, GDPR, backups, terms of service | The section 8 checklist passes | Not started |
| **6. Ops** | Morning carry-over and follow-up check (scheduled workflow → queue), DB backup workflow, error monitoring, Redis cache and rate limiting | cron, scheduled jobs, backup/restore, logging, monitoring, alerting, cache, TTL | Each morning, today's to-dos are ready without you doing anything | Not started |
| **7. Meetings** | Meeting notes, decisions, action items → assignee to-dos via the queue | event fan-out, many-to-many | Meeting action items appear in each assignee's to-dos automatically | Not started |
| **8. Email + Calendar** | Detect Gmail replies to update labels automatically; schedule interviews with Google Calendar | OAuth scopes, webhooks, polling vs push, API rate limits | A candidate's reply removes "Awaiting reply" without you touching it | Not started |
| **9. Scorecards + Reports** | Interviewer scorecards, stage-to-stage conversion (funnel), time in stage | SQL aggregation, GROUP BY, indexes, charts, analytics | You see this month's hiring funnel on one screen | Not started |
| **10. Candidate portal** | Candidates check their own status and pick interview slots | public vs private APIs, magic links, rate limiting, security | A candidate sees their status from a single link | Not started |
| **11. Infra Lab** | Deploy the app's Docker image to kind (local Kubernetes); manage GitHub and Vercel settings with Terraform | container registry, pods, deployments, services, Helm, IaC, state, plan/apply | You can explain the output of `terraform plan` and `kubectl get pods` | Not started |
| **12. AI** | Note summaries, follow-up email drafts, semantic search | LLMs, prompts, tokens, embeddings, pgvector, RAG | Searching long-term notes for "last month's decisions" finds them | Not started |

Pick Afterward phases by what helps your work most: Phase 8 first if tracking replies is the most painful part, Phase 7 if team meetings are. Only the Infra Lab (11) is kept apart from production code, and AI (12) is built only in ways that never send candidate data to a free tier.

## 7. Working with Claude Code (learning mode)

You write the important code; Claude Code explains, reviews, and debugs. If it wrote everything, the app would ship sooner, but you wouldn't gain the understanding you need in meetings.

| Area | You do | Claude Code does |
| --- | --- | --- |
| Accounts and setup | Create accounts, install tools, manage API keys | Step-by-step guidance, fixing errors |
| Concepts | Ask "why?" until it makes sense | Explains with analogies and examples from this app |
| Code | Write the design-decision code yourself, commit, and push | Handles boilerplate, leaves `TODO(human)` spots, reviews, explains bugs |
| Design | Make the final call | Lays out options and trade-offs |
| Explaining | Write PR descriptions and README notes in your own words | Checks your explanation and fills gaps |

Every session follows the same loop:

1. **Plan** — Agree on one small task from the current phase.
2. **Concept** — Claude Code explains the concepts needed, briefly.
3. **Build** — You write the key code. When stuck, paste the full error message.
4. **Review** — Claude Code reviews your diff the way a senior engineer would.
5. **Explain** — You write the PR description in your own words.
6. **Ship** — Open the PR, let CI pass, merge, and use the result.

### Turn on the Learning output style

Claude Code has a built-in [**Learning** output style](https://code.claude.com/docs/en/output-styles): it explains its choices in short Insight blocks, handles routine code itself, and leaves pieces with real design decisions for you, marked `TODO(human)`. Run `/output-style learning` once in the project; the choice is saved to `.claude/settings.local.json`.

### CLAUDE.md for this project

`CLAUDE.md` holds what Claude Code should know about the project and stays loaded whichever output style you use. Save this as `CLAUDE.md` at the repo root in Phase 0:

```markdown
# SWE Hub — instructions for Claude Code

## Who I am
I manage hiring and meetings for an SWE team. I am building this app to
learn software engineering by doing it. I am new to coding.

## How to work with me (learning mode)
- Teach, don't just do. Explain the concept briefly before writing code.
- Leave the meaningful parts for me (TODO(human)): data modeling, business
  logic, error handling. Do boilerplate and config yourself, and explain it.
- One small task at a time. Stop after each step and wait for me.
- When I paste an error, explain the cause before giving the fix.
- Review my diffs like a senior engineer: correctness, naming, security, tests.
- Connect new terms to this app ("Redis would sit here because...").
- Every change goes through a branch and a PR. Never push to main.

## Project
- Full plan: docs/PLAN.md (exported from the project plan doc).
- Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres),
  Vercel, GitHub Actions; RabbitMQ (CloudAMQP) from Phase 4.
- Current phase: Phase 0 - Setup + CI/CD.
- Version 1 = the Hiring Board in docs/PLAN.md section 2.

## Rules
- Fake data only. Never put real candidate data in code, seeds, tests, or logs.
- Never commit secrets. Use .env.local and GitHub Secrets.
- Database changes only through migration files.
- Queue messages carry IDs only, never personal data.
```

Update the "Current phase" line as you move forward. To give Claude Code the full plan, export this doc as Markdown, save it in the repo as `docs/PLAN.md`, and start the first session with:

> Read CLAUDE.md and docs/PLAN.md. We're starting Phase 0. Explain what we'll set up and why, then give me only the first step.

When a meeting term comes up that you don't know, ask in a session. Claude Code can show where it would fit in this app, or which phase will use it.

## 8. Risks and the Team rollout gate

The biggest risk is **candidate personal data**, not technology. Names, contact details, and interview notes are personal data, covered by laws such as GDPR in the UK and EU. Use fake data through Phase 5, and bring in real data and teammates only after every item below is done.

- [ ] Get approval from HR or your manager before storing real candidate data in this tool
- [ ] Store only what you need (no CV files or interview scores at first; CVs stay as links)
- [ ] Turn on RLS for every table and test it with a second account
- [ ] Put only IDs in queue messages, never personal data (messages pass through CloudAMQP, an outside service)
- [ ] Never send candidate data to the Gemini free tier (free-tier input may be used to improve Google products)
- [ ] Decide hosting for team use: Vercel Pro ($20/user/month), Cloudflare, or company infrastructure
- [ ] Set up automated database backups (Supabase free has none)
- [ ] Define a retention rule, e.g. delete rejected candidates' data after N months
- [ ] Keep secrets out of Git: use `.env.local` and GitHub Secrets, never commit API keys

Hosting options: [Vercel Hobby](https://vercel.com/docs/plans/hobby) is limited to personal, non-commercial use, and Pro costs $20 per developer per month. [Cloudflare](https://vpsranking.com/serverless/vercel/)'s free plan allows commercial use, but Next.js needs the [OpenNext adapter](https://temps.sh/blog/cloudflare-pages-free-tier-limits-2026), and a growing app can hit the [free plan's size limit](https://makerkit.dev/docs/md/next-supabase-turbo/going-to-production/cloudflare). Either way, moving hosts is a good lesson in vendor lock-in and portability.

Free services can also pause or disappear. Supabase free projects pause after 7 days without use, and CloudAMQP free instances are deleted after 2 months without messages. Keep the DB schema (migrations), queue setup, and workflows as code in GitHub so you can recreate everything. That is where Infrastructure as Code starts.

## 9. Next steps: Phase 0

Phase 0 builds the path from your computer to GitHub to the internet once, end to end, and adds automated checks (CI) and automated deploys (CD) to that path. These are yours to do:

- [ ] Install VS Code (code editor)
- [ ] Install Node.js LTS and check it with `node -v` in the terminal
- [ ] Install Git and set `git config --global user.name` and `user.email`
- [ ] Create a GitHub account and turn on two-factor authentication (2FA)
- [ ] Create a Vercel account (Hobby) by signing in with GitHub
- [ ] Create a Supabase account (you'll create the project in Phase 1)
- [ ] Install Claude Code if you haven't, and run `/output-style learning` in the project
- [ ] Write down your real interview stages and the labels you want, to adjust the presets in section 2
- [ ] Once the repo exists, add `CLAUDE.md` (section 7) and export this doc as `docs/PLAN.md`

The first session creates the project with `create-next-app`, pushes it to GitHub, deploys it to Vercel, and adds your first GitHub Actions workflow, which runs lint and build on every PR.

## Sources&#32;

- [Output styles — Claude Code Docs](https://code.claude.com/docs/en/output-styles)
- [Vercel Hobby Plan — Vercel Docs](https://vercel.com/docs/plans/hobby)
- [Supabase Pricing: 2026 Guide — Jet Admin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [Upstash Redis Pricing](https://upstash.com/pricing/redis)
- [CloudAMQP Plans & Pricing](https://www.cloudamqp.com/plans/)
- [Gemini API Free Tier Limits — YingTu](https://yingtu.ai/en/blog/google-gemini-api-free-tier-limits-2026)
- [Is GitHub Actions free? — cicdcalculator](https://cicdcalculator.com/github-actions-free-tier)
- [Vercel vs alternatives — vpsranking](https://vpsranking.com/serverless/vercel/)
- [Cloudflare Pages free tier limits 2026 — temps.sh](https://temps.sh/blog/cloudflare-pages-free-tier-limits-2026)
- [Deploy Next.js Supabase to Cloudflare — MakerKit](https://makerkit.dev/docs/md/next-supabase-turbo/going-to-production/cloudflare)
