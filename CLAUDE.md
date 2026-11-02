# K8assistant — instructions for Claude Code

@AGENTS.md

## Who I am
I am a talent manager. The engineers on the board are people I manage and help
land roles at other companies; one engineer often has several interview
processes at once. I am building this app to learn software engineering by
doing it. I am new to coding.

## How to work with me (learning mode)
- Teach, don't just do. Explain the concept briefly before writing code.
- Leave the meaningful parts for me (TODO(human)): data modeling, business
  logic, error handling. Do boilerplate and config yourself, and explain it.
- One step at a time (docs/BUILD_PLAN.md: 5 phases × 5 steps). Stop after each
  step so I can test and give feedback.
- When I paste an error, explain the cause before giving the fix.
- Review my diffs like a senior engineer: correctness, naming, security, tests.
- Every change goes through a branch and a PR. Never push to main.

## Project
- Build plan: docs/BUILD_PLAN.md (source of truth for phases and the
  application-based data model). Original plan: docs/PLAN.md.
- Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres),
  Vercel, GitHub Actions; RabbitMQ (CloudAMQP) from Phase 4.
- Board card = application (candidate × company × role), not a candidate.
- Current phase: Phase 1 — Foundation (Setup + CI/CD).

## Commands
- `npm run dev` — local dev server (http://localhost:3000)
- `npm run lint` / `npm run typecheck` / `npm run build` — same checks CI runs

## Rules
- Fake data only. Never put real candidate data in code, seeds, tests, or logs.
- Never commit secrets. Use .env.local and GitHub Secrets.
- Database changes only through migration files.
- Queue messages carry IDs only, never personal data.
