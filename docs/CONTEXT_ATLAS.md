# Context Atlas

The Context Atlas is the numbered map of every file the harness agents read. Each file has a three-digit coordinate. Agents use coordinates to open only the files a task needs, instead of searching the whole repo.

The index is `.spec/ATLAS.md`. This page defines the rules around it.

## Sectors

| Sector | Meaning | Files and coordinates |
| --- | --- | --- |
| `000` Card Catalog | Agent instructions | `AGENTS.md` (010), `CLAUDE.md` (000, a pointer), this page (020) |
| `100` Work Dispatch | Slice queue and logs | `.spec/PROGRESS.md` (110), `.spec/archive/HISTORY.md` (120), `.spec/BLACK_BOX.md` (130, only after a failure), `.spec/SESSION_HANDOFF.md` (140) |
| `200` Boundaries | What may and may not change | `.spec/boundaries/locks.md` (210), `.spec/boundaries/do-not-build.md` (220), `.spec/EXTERNAL_AGENT_RULES.md` (230) |
| `300` Contracts | Config and rule contracts | `.harness/config/thresholds.json` (305), `.spec/contracts/referee.md` (310), `.spec/contracts/circuit-breaker.md` (320), `.spec/contracts/baton-pass.md` (330), `.spec/contracts/review-relay.md` (340) |
| `400` System Spec | Architecture and decisions | `.spec/SYSTEM_SPEC.md` (400), `.spec/DECISIONS.md` (410), `.spec/OVERVIEW.md` (420), `.spec/AI_STUDIO_RULES.md` (430) |

`.spec/ATLAS.md` is the machine-checked copy of this table. If the two ever disagree, `.spec/ATLAS.md` wins for the tools, and this page should be corrected in the same change.

## What an agent reads

An agent opens:

1. The coordinates listed in its slice's `Coords:` field in `.spec/PROGRESS.md`.
2. The files in that slice's `Target files:` list.

Nothing else is needed. Agents do not scan the repo to find context.

## Size rule

Each Atlas file has a soft line cap in `.harness/config/thresholds.json` under `line_budgets.soft_caps`. `npm run lint` runs `navigator.mjs --check`, which reports any file over its cap and any broken coordinate or link.

Files without a cap, such as `SYSTEM_SPEC.md` and `DECISIONS.md`, have no line check.

## Staleness rule

- Every new `.spec/` file gets a coordinate in `.spec/ATLAS.md` in the same commit that creates it.
- Every coordinate listed in `.spec/ATLAS.md` must point to a file that exists.
- A slice's `Coords:` must use coordinates that exist in `.spec/ATLAS.md`. The exit gate for the architect checks this.

Lint enforces the second rule and the size rule. The first rule is a convention for whoever creates the file, backed by the `gf-navigator` agent; nothing blocks a commit that skips it yet.

## Who maintains it

- `el-architect` keeps the registry current when it writes specs.
- `gf-navigator` checks that every `.spec/` file is indexed and compacts files that go over their cap.
- `gf-coder` cannot edit `.spec/ATLAS.md`; `pre-tool-guard.mjs` blocks it.
