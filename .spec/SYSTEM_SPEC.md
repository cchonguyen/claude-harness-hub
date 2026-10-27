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
