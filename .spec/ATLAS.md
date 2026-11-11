# Context Atlas

The single entry point and registry for harness-hub specification artifacts. Definition and rules: [docs/CONTEXT_ATLAS.md](../docs/CONTEXT_ATLAS.md).

## Sector 000 Card Catalog
- `000` [CLAUDE.md](../CLAUDE.md) — 5-line pointer to agent instructions
- `010` [AGENTS.md](../AGENTS.md) — Universal agent catalog & role definitions
- `020` [docs/CONTEXT_ATLAS.md](../docs/CONTEXT_ATLAS.md) — Atlas definition & rules

## Sector 100 Work Dispatch
- `110` [.spec/PROGRESS.md](PROGRESS.md) — Active slice queue & lock
- `120` [.spec/archive/HISTORY.md](archive/HISTORY.md) — Completed slice archive
- `130` `.spec/BLACK_BOX.md` — Sector 130 flight-recorder dump on 2-strike failure
- `140` [.spec/SESSION_HANDOFF.md](SESSION_HANDOFF.md) — Session handoff state

## Sector 200 Boundaries
- `210` [.spec/boundaries/locks.md](boundaries/locks.md) — File lock invariants & spoke boundaries
- `220` [.spec/boundaries/do-not-build.md](boundaries/do-not-build.md) — Strictly out-of-scope list
- `230` [.spec/EXTERNAL_AGENT_RULES.md](EXTERNAL_AGENT_RULES.md) — Rules for external agents

## Sector 300 Contracts
- `305` [.harness/config/thresholds.json](../.harness/config/thresholds.json) — System thresholds & line budgets
- `310` [.spec/contracts/referee.md](contracts/referee.md) — Neutral Referee arbiter & trailer contract
- `320` [.spec/contracts/circuit-breaker.md](contracts/circuit-breaker.md) — Circuit breakers & freeze protocol
- `330` [.spec/contracts/baton-pass.md](contracts/baton-pass.md) — Dual platform handoff contract
- `340` [.spec/contracts/review-relay.md](contracts/review-relay.md) — Structured review registry & PR scope gate

## Sector 400 System Spec
- `400` [.spec/SYSTEM_SPEC.md](SYSTEM_SPEC.md) — System specification & contracts (design intent)
- `401` [.spec/HARNESS_SPEC.md](HARNESS_SPEC.md) — As-built harness specification (what runs today)
- `410` [.spec/DECISIONS.md](DECISIONS.md) — Architecture Decision Records (ADRs)
- `420` [.spec/OVERVIEW.md](OVERVIEW.md) — Project overview & test status
- `430` [.spec/AI_STUDIO_RULES.md](AI_STUDIO_RULES.md) — AI Studio rules template
- `440` [.spec/plans/README.md](plans/README.md) — Plan-merge approval format
- `441` [.spec/plans/harness-doctor-phase1.md](plans/harness-doctor-phase1.md) — Phase 1 doctor and telemetry plan (slices 10.1, 10.2)
- `442` [.spec/post-mortems/dispatch-telemetry-2026-11-06.md](post-mortems/dispatch-telemetry-2026-11-06.md) — Dispatch telemetry post-mortem and gate-off record (slice 10.8)
- `443` [.spec/post-mortems/harness-council-review-2026-11-06.md](post-mortems/harness-council-review-2026-11-06.md) — Post-mortem and questions for external council review
- `444` [.spec/SCOUT.md](SCOUT.md) — Latest /triage scout metrics (files touched, contract change, cross-module)
