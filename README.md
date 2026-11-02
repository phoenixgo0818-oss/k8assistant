# K8assistant

A pipeline board for a talent manager: track every engineer you manage and
every interview process they're in, across companies, on one board.

A personal learning project — built phase by phase, see
[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Run locally

```bash
nvm use            # Node version from .nvmrc
npm install
npm run dev        # http://localhost:3000
```

## Checks (also run in CI on every PR)

```bash
npm run lint
npm run typecheck
npm run build
```
