# System Specification & Contracts

## 1. Core Scope & MVP Boundaries
- Provide deterministic hooks, model-routed subagents, and zero-cost Gemini audit handoffs.
- **Gemini Bridge reference inlining:** in `spec` mode, `bundle-handoff.mjs` scans `.spec/SYSTEM_SPEC.md` (and `.spec/OVERVIEW.md`) for local Markdown links, resolves the ones that exist inside the repository, and inlines their contents under an `# APPENDED REFERENCES` section of `.spec/HANDOFF_PACKET.md`. Links outside the repo root, URLs, and missing files are skipped.

## 2. Strictly Out of Scope ("Do NOT Build" List)
- No paid external API calls inside hooks.
- No external npm dependencies inside `.harness/`.
- No symlinks outside the repository root.
- No printing raw handoff bundles or file contents to stdout. `/prep-audit` outputs a single-line receipt pointing to `.spec/HANDOFF_PACKET.md`.
- No `git remote add` during spoke bootstrap. Remotes vanish when a Cloud container restarts; spokes sync by copying from a sibling checkout.

## 3. Data Models & Module Boundaries
- `.claude/`: Subagents, commands, settings, and `harness-rules.md`.
- `.harness/`: Zero-dependency Node.js hooks and scripts.
- `.spec/`: Project state and specification artifacts.

### Spoke Connection Contract
1. **Hub pointer:** every spoke commits `.harness/hub.json`, e.g. `{ "repo": "claude-harness-hub", "owner": "cchonguyen", "branch": "main" }`.
2. **Discovery:** `hub-sync.mjs` looks for a sibling checkout at `../<repo>` (the layout a Cloud container uses when both repos are attached to the session). If none is found, it prints a `HUB_NOT_ATTACHED` error with the settings steps to attach the hub repo, and exits without changing anything. An existing `harness-hub` git remote is honoured as a fallback but is never created.
3. **Sync boundary:** sync overwrites only engine files (`.claude/`, `.harness/`, `.harness-version`). Project-owned files (`.spec/`, root `CLAUDE.md`) are never written by sync.

### Vibe Mode Checkpoint Rule
- The "last known green" checkpoint advances only when a command that executes code passes: test runners (`vitest`, `jest`, `pytest`, `npm|pnpm|yarn|bun test`) or a build (`npm|pnpm|yarn|bun run build`).
- Static checks (`eslint`, `ruff check`, `ruff format --check`, `mypy`, `pyright`, `tsc`, `typecheck`, `lint` scripts) still count toward the circuit breaker and still get their output scrubbed, but a pass never advances the checkpoint. Lint-clean code can still be logically broken, and locking it in would make a restore land on a regression.
- If a project has no test or build command, no checkpoint ever advances; `--restore` then only lists the changed files, as it does before the first pass.
