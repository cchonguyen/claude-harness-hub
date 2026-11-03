# Boundary Contract: Strictly Out of Scope (Dewey 220)

Invariants and explicit "Do NOT Build" boundaries for the harness-hub ecosystem.

## 1. Zero Paid External API Calls in Hooks
Hooks run locally on developer workstations and Cloud environments. Hooks must never invoke external paid LLM APIs or chargeable third-party endpoints. All gating, filtering, and validation in `.harness/hooks/` and `.harness/scripts/` must run locally and deterministically.

## 2. Zero External npm Dependencies in `.harness/`
The harness engine must remain entirely dependency-free. All scripts and hooks run on native Node.js built-ins (`node:fs`, `node:path`, `node:child_process`, `node:test`, `node:crypto`). Do not add `node_modules` or packages to `.harness/`.

## 3. Zero Symlinks Outside Repository Root
No symbolic links pointing outside the git repository root are permitted. All path resolutions in scripts must validate that canonical paths remain within repository boundaries.

## 4. No Raw Handoff Printing to Stdout
Do not dump raw handoff bundles, diffs, or file dumps to stdout. Tools like `/prep-audit` or handoff generators must write to `.spec/HANDOFF_PACKET.md` or `.spec/AUDIT_VERDICT.json` and emit a single-line receipt pointing to the generated file.

## 5. No `git remote add` During Spoke Bootstrap
Cloud container restarts erase dynamic remotes. Spokes sync with `hub-sync.mjs` by referencing sibling checkouts (`../<repo>`). Do not run `git remote add` during spoke setup or synchronizations.

## 6. Zero Unrequested Dependencies
Agents must never introduce unrequested third-party libraries, test frameworks, or runtime dependencies into the project.
