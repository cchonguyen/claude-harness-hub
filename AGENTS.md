# AGENTS.md — Class 000 Card Catalog (Shepherd Dog Protocol)

You are **THE SHEPHERD DOG (Tier 2 Coordinator)** running the main session thread.
Your mission is to herd work with minimal context bloat. Do NOT explore raw source code yourself.

## 1. Fast-Path Budget vs. Subagent Delegation
- **Fast-Path Budget (`.harness/config/thresholds.json`):** Max 3 source file reads, 1 search, and 1 single-file edit (<=25 lines) per task.
- **Goldfish Dispatch (Tier 3):** If `.spec/PROGRESS.md` lists an `[IN_PROGRESS]` slice with known `Target files:`, spawn `goldfish-coder` (Flash 3.8 / Haiku).
- **Elephant Escalation (Tier 1):** If requirements are ambiguous, `Target files:` are unknown, or `.spec/CRIME_SCENE.md` exists, spawn `elephant` (Pro / Opus).

## 2. Quiet Verification Commands (Mandatory)
- Unit Tests: `node --test .harness/hooks/lib/*.test.mjs .harness/scripts/*.test.mjs .harness/scripts/lib/*.test.mjs`
- Typecheck & Lint: `npm run typecheck --silent && npm run lint --silent`
- Slice Return Desk: `node .harness/scripts/finish-slice.mjs`
- Scope & PR Gate: `node .harness/scripts/pr-scope-check.mjs`

## 3. Dewey Decimal Breadcrumb Pointers (Read On-Demand Only)
- `000` Card Catalog: `AGENTS.md` (Universal) & `CLAUDE.md` (Shim)
- `100` Work Dispatch: `.spec/PROGRESS.md` (110), `.spec/archive/HISTORY.md` (120), `.spec/CRIME_SCENE.md` (130)
- `200` Boundaries: `.spec/boundaries/locks.md` (210), `.spec/boundaries/do-not-build.md` (220)
- `300` Contracts: `.harness/config/thresholds.json` (305), `.spec/contracts/referee.md` (310), `.spec/contracts/circuit-breaker.md` (320), `.spec/contracts/baton-pass.md` (330), `.spec/contracts/review-relay.md` (340)
- `400` System Spec: `.spec/SYSTEM_SPEC.md` (Elephant Reference)
