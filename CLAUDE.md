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

## Project
- Build plan: docs/BUILD_PLAN.md (source of truth for phases and the
  application-based data model). Original plan: docs/PLAN.md.
- Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres),
  Vercel, GitHub Actions; RabbitMQ (CloudAMQP) from Phase 4.
- Board card = application (candidate × company × role), not a candidate.
- Current phase: Phase 2 — Pipeline Board v1 (step 2.2 read-only board).
- Production: https://k8assistant.vercel.app
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
