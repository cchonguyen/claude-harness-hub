# Context Atlas

The single entry point and registry for harness-hub specification artifacts.

## Sector 000 Card Catalog
- `000` [CLAUDE.md](../CLAUDE.md) — 5-line pointer to agent instructions
- `010` [AGENTS.md](../AGENTS.md) — Universal agent catalog & role definitions

## Sector 100 Work Dispatch
- `110` [.spec/PROGRESS.md](PROGRESS.md) — Active slice queue & lock
- `120` [.spec/archive/HISTORY.md](archive/HISTORY.md) — Completed slice archive
- `130` `.spec/BLACK_BOX.md` — Sector 130 flight-recorder dump on 2-strike failure

## Sector 200 Boundaries
- `210` [.spec/boundaries/locks.md](boundaries/locks.md) — File lock invariants & spoke boundaries
- `220` [.spec/boundaries/do-not-build.md](boundaries/do-not-build.md) — Strictly out-of-scope list

## Sector 300 Contracts
- `305` [.harness/config/thresholds.json](../.harness/config/thresholds.json) — System thresholds & line budgets
- `310` [.spec/contracts/referee.md](contracts/referee.md) — Neutral Referee arbiter & trailer contract
- `320` [.spec/contracts/circuit-breaker.md](contracts/circuit-breaker.md) — Circuit breakers & freeze protocol
- `330` [.spec/contracts/baton-pass.md](contracts/baton-pass.md) — Dual platform handoff contract
- `340` [.spec/contracts/review-relay.md](contracts/review-relay.md) — Structured review registry & PR scope gate

## Sector 400 System Spec
- `400` [.spec/SYSTEM_SPEC.md](SYSTEM_SPEC.md) — System specification & contracts
- `410` [.spec/DECISIONS.md](DECISIONS.md) — Architecture Decision Records (ADRs)
