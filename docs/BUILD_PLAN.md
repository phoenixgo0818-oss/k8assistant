# SWE Hub — Build Plan (5 phases × 5 steps)

Derived from `doc/PLAN.md`. The whole build is grouped into **5 phases**, each with **5 steps**.
After every step we stop: you test it, give feedback, and only then we move on.

Per step: **Build** (what we make) · **Test** (what you do) · **Done when**.
Status: ⬜ not started · 🟨 in progress · ✅ done

---

## Changes from PLAN.md (decided 2026-11-02)

**I am a talent manager, not an employer.** The people on the board are engineers *I manage*,
and I help them land roles at **other companies**. One engineer often has several interview
processes running at once, each at a different stage.

So the model changes:

| PLAN.md | Now |
| --- | --- |
| Card = one candidate | Card = one **application** (candidate × company × role) |
| `candidates.stage_id`, `rank` | Moved to `applications` |
| Labels on a candidate | Labels on an **application** ("Scheduled" is about *this* process) |
| Notes / activity per candidate | Per **application** (shown together on the candidate's profile) |
| — | New `companies` table (client companies and their roles) |
| HR approval before real data | Consent from the engineers I manage + approval from my employer |

- **Candidate profile** (name, skills, years, links, context…) is entered once and shared by all their applications.
- **Board view**: columns = stages, cards = applications ("Alex Kim → Acme · Backend").
- **Candidate view**: one engineer, all their processes and where each one stands.
- The "split candidates into applications" migration PLAN.md §5 left for later is done from the start.

---

## Phase 1 — Foundation: Setup + CI/CD  🟨 current
*(PLAN.md Phase 0)* Goal: one path *laptop → GitHub → internet*, with automated checks and deploys.

### 1.1 Local toolchain ⬜
- **Build:** Node.js LTS via `nvm`; log in to `gh`.
- **Test:** `node -v`, `npm -v`, `gh auth status`.
- **Done when:** all three succeed.

### 1.2 Next.js skeleton ⬜
- **Build:** `create-next-app` (TypeScript, Tailwind, ESLint, App Router, `src/`); add `CLAUDE.md`; rename `doc/` → `docs/`.
- **Test:** `npm run dev` → http://localhost:3000; `npm run lint` and `npm run build` pass.
- **Done when:** the starter page renders and lint + build are green.

### 1.3 GitHub repo + branch workflow ⬜
- **Build:** Create the GitHub repo, push `main`; from now on all work happens on branches.
- **Test:** You open your first PR from a branch (e.g. change the page title).
- **Done when:** the repo is on GitHub and a PR is open.

### 1.4 CI with GitHub Actions ⬜
- **Build:** `.github/workflows/ci.yml`: `npm ci`, lint, type check, build on every PR.
- **Test:** Break lint on purpose → red; fix → green.
- **Done when:** every PR shows a CI check and a broken change fails it.

### 1.5 CD with Vercel ⬜
- **Build:** Import the repo into Vercel (Hobby): preview URL per PR, production on merge; branch protection (CI must pass).
- **Test:** PR → preview works; merge → production updates.
- **Done when:** *"Opening a PR runs checks automatically, and merging to main deploys."*

---

## Phase 2 — Pipeline Board v1
*(PLAN.md Phase 1, with the application model)*

### 2.1 Database + schema ⬜
- **Build:** Supabase project + local Supabase CLI. Migration for `workspaces`, `stages`, `labels`, `companies`, `candidates`, `applications`, `application_labels`, `application_notes`, `activities` (all with `workspace_id`). Seed presets + 15 fake engineers with ~25 applications.
- **Test:** Inspect tables in Supabase Studio; rebuild the DB from scratch.
- **Done when:** a fresh DB comes only from migration + seed files.

### 2.2 Read-only board + candidate view ⬜
- **Build:** Board (stage columns with counts, application cards with company, role, labels); candidate page listing all their applications.
- **Test:** One engineer with 3 applications shows 3 cards in different columns, and all 3 on their page.
- **Done when:** both views match the seed data.

### 2.3 Create + drag and drop ⬜
- **Build:** "+ New candidate" (name only) and "+ New application" (candidate + company + role → New); dnd-kit drag with fractional `rank`; activity row on stage change (synchronous).
- **Test:** Add an engineer and two applications; drag cards; refresh.
- **Done when:** new cards appear instantly and positions survive refresh.

### 2.4 Detail panel ⬜
- **Build:** Side panel per application: candidate fields (shared), stage dropdown, labels (add / remove / create), notes with timestamp + stage, activity history.
- **Test:** Edit a skill (it changes on all of that engineer's cards); add a note; change labels; check activity.
- **Done when:** every change appears in activity; notes show timestamp + stage.

### 2.5 Custom stages/labels, search, filters, archive ⬜
- **Build:** Manage stages and labels; search by name / skill / company; filter by label, role, company; collapse final columns; archive.
- **Test:** Run the v1 acceptance criteria (PLAN.md §2, read with "application" for "profile").
- **Done when:** all of them pass with the fake data.

---

## Phase 3 — To-do, Notes, Auth + Testing
*(PLAN.md Phases 2 + 3)*

### 3.1 Daily To-do ⬜
- **Build:** `todos`: Today list, due date, priority, done, carry-over of unfinished items; optional link to a candidate or application.
- **Done when:** you plan a real day in the app.

### 3.2 Notes ⬜
- **Build:** `notes` + `note_links`: Markdown, tags, pinning, links to candidates / applications / to-dos, full-text search.
- **Done when:** you run one week of work using only the app.

### 3.3 Unit tests ⬜
- **Build:** Vitest; tests for fractional ranking, carry-over, and stage-move logic; run in CI.
- **Done when:** breaking the ranking logic turns CI red.

### 3.4 Google sign-in + RLS ⬜
- **Build:** Supabase Auth (Google), `user_profiles`, RLS on every table.
- **Test:** A second Google account sees nothing.
- **Done when:** signed-out and other-account access is blocked.

### 3.5 E2E tests + branch protection ⬜
- **Build:** Playwright for the core flows (add candidate, add application, drag, note); required in CI.
- **Done when:** a failing test blocks the merge.

---

## Phase 4 — Automation: Queue + Ops
*(PLAN.md Phases 4 + 6)*

### 4.1 Docker + RabbitMQ locally ⬜
- **Build:** docker-compose with Postgres + RabbitMQ; walk through the RabbitMQ admin UI.
- **Done when:** you publish and consume a test message by hand.

### 4.2 Transactional outbox ⬜
- **Build:** `events` written in the same transaction as stage/label changes; a publisher that sends them to RabbitMQ (IDs only, no personal data).
- **Done when:** a stage change creates exactly one event, even if publishing fails.

### 4.3 Consumers ⬜
- **Build:** Node worker: activity history (moved from sync), follow-up to-dos (e.g. "Waiting assessment" → to-do due in N days), notifications; `processed_messages` for idempotency; retries + dead-letter queue.
- **Done when:** stopping the worker loses nothing, and redelivery doesn't create duplicate to-dos.

### 4.4 Queue in CI + cloud ⬜
- **Build:** RabbitMQ service container in CI integration tests; CloudAMQP + webhook into a Vercel route.
- **Done when:** the deployed app creates follow-up to-dos.

### 4.5 Ops ⬜
- **Build:** Scheduled workflow for the morning carry-over and follow-ups; DB backup workflow; error monitoring; Upstash Redis cache + rate limiting.
- **Done when:** each morning today's to-dos are ready without you doing anything.

---

## Phase 5 — Team + Rollout
*(PLAN.md Phase 5 + Team rollout gate)*

### 5.1 Memberships + roles ⬜
- **Build:** `memberships` (Admin / Member / Viewer) enforced in RLS.

### 5.2 Invites + assignees ⬜
- **Build:** Workspace invites; assign a teammate to a candidate or application.

### 5.3 Comments ⬜
- **Build:** `comments` on applications, with notifications through the queue.

### 5.4 Staging + production ⬜
- **Build:** Separate Supabase projects and Vercel environments; secrets per environment.
- **Done when:** an invited teammate works on the same board in staging (fake data).

### 5.5 Rollout gate ⬜
- **Build:** Hosting decision (Vercel Pro / Cloudflare / company), a data-retention rule, a tested backup restore, consent from the engineers you manage, and employer approval.
- **Done when:** the PLAN.md §8 checklist passes, with real data allowed only after that.

---

## Backlog (after Phase 5, pick by need)
- **Email + Calendar**: Gmail replies clear "Awaiting reply"; schedule interviews.
- **Reports**: stage-to-stage conversion per company, time in stage, placements per month.
- **Candidate portal**: the engineers you manage see their own processes from one link (a natural fit now).
- **Meetings**: action items → to-dos.
- **Infra Lab**: Kubernetes (kind) + Terraform.
- **AI**: note summaries, semantic search (never with real candidate data on a free tier).
