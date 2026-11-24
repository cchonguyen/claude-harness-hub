# Context Atlas

The Context Atlas is the numbered map of every file the harness agents read. Each file has a three-digit coordinate. Agents use coordinates to open only the files a task needs, instead of searching the whole repo.

The index is `.spec/ATLAS.md`. This page defines the rules around it.

## Sectors

| Sector | Meaning |
| --- | --- |
| `000` Card Catalog | Agent instructions |
| `100` Work Dispatch | Slice queue and logs |
| `200` Boundaries | What may and may not change |
| `300` Contracts | Config and rule contracts |
| `400` System Spec | Architecture, decisions, plans and post-mortems |

The coordinates for each file are listed only in `.spec/ATLAS.md`, which lint checks. Add a new file there, not here.

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
- `gf-coder` should not edit `.spec/ATLAS.md` unless it is a target file. Nothing blocks it: the old state-file denial was turned off on 2026-11-06, so an edit outside `Target files:` only raises a SCOPE LOCK warning and a `Scope-Widened:` trailer.
