# K8assistant — instructions for Claude Code

@AGENTS.md

## Who I am
I am a talent manager. The engineers on the board are people I manage and help
land roles at other companies; one engineer often has several interview
processes at once. I am building this app to learn software engineering by
doing it. I am new to coding.

## How to work with me
- Implement each step completely yourself, including data modeling and
  business logic. No TODO(human) parts.
- After each step, explain what you built and the concepts behind it, and give
  me practical tips.
- One step at a time (docs/BUILD_PLAN.md: 5 phases × 5 steps). Stop after each
  step so I can test and give feedback.
- Only hand me what needs my own accounts (dashboards, logins, secrets).
- When I paste an error, explain the cause before giving the fix.
- Review my diffs like a senior engineer: correctness, naming, security, tests.
- Every change goes through a branch and a PR. Never push to main.
- One topic per PR (theme, a feature, a fix), not several topics in one PR.
- Match testing to risk (I can override per task with "quick" or "full test"):
  - Low risk (colours, text, layout): lint + typecheck + build, plus one
    screenshot if it's visual.
  - Higher risk (saving data, drag and drop, migrations, deleting): a focused
    browser test of just that feature, using only `E2E …` records.
  - Use screenshots sparingly; they're expensive.

## Project
- Build plan: docs/BUILD_PLAN.md (source of truth for phases and the
  application-based data model). Original plan: docs/PLAN.md.
- Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres),
  Vercel, GitHub Actions; RabbitMQ (CloudAMQP) from Phase 4.
- Board card = application (candidate × company × role), not a candidate.
- Current phase: Phase 3 — Auth, Upcoming events, Notes + Testing (3.1 sign-in done).
- Writes go through Server Actions (`src/app/actions.ts`, zod-validated) that
  call Postgres functions (RPC) so each change + its activity row is one transaction.
- Production: https://k8assistant.vercel.app
- Design system: tokens + `glass`, `glass-strong`, `brand-gradient`, `brand-text`
  utilities and `.btn-primary` / `.btn-secondary` / `.input-field` live in
  `src/app/globals.css`; use them instead of one-off colours. Brand = VS Code-logo
  blues (#1f9cf0 → #007acc → #0065a9) as a gradient backdrop; text directly on it
  uses `text-on-backdrop`; non-board pages sit on a `glass-strong` sheet with
  `glass-inset` lists inside.
  Each engineer has a `color` (palette in `src/lib/constants.ts` and the DB).
  Cards use `card-material` (no backdrop blur on cards: too costly at scale).
- Board performance: Column/SortableCard/ApplicationCard are memoised; hover
  spotlight is CSS via one <style> tag (no React state); the detail panel
  streams in a Suspense boundary while PanelPreview shows instantly.
- Board page fits the window: the board scrolls inside its own area (top
  ~70%) and the Upcoming events panel (`src/components/todos/`) fills the
  bottom ~30%, streaming in its own Suspense boundary. "Today" uses
  `APP_TIME_ZONE` in `src/lib/todos.ts`. Refresh demo event dates with
  `npx supabase db query --linked -f supabase/seed_events.sql`.
- Vercel functions run in lhr1 (London) next to Supabase eu-west-2 (vercel.json).
- Local scratch (test scripts, screenshots) goes in git-ignored `.tmp/`.
- Supabase project ref: iyusfcsxadcrnxwqrgxb (dev DB, fake data).
- Data access is server-only (`src/lib/supabase.ts`, secret key, `server-only`).
  `cacheComponents` is on: request-time reads call `await connection()` and sit
  under a Suspense boundary (`loading.tsx`); `export const dynamic` is not allowed.

## Commands
- `npm run dev` — local dev server (http://localhost:3000)
- `npm run lint` / `npm run typecheck` / `npm run build` — same checks CI runs
- `npm run db:push` — apply new migrations to Supabase
- `npm run db:types` — regenerate `src/lib/database.types.ts` after schema changes

## Rules
- Fake data only. Never put real candidate data in code, seeds, tests, or logs.
- Never commit secrets. Use .env.local and GitHub Secrets.
- Database changes only through migration files.
- Queue messages carry IDs only, never personal data.
