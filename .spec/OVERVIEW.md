# Project Overview (Owner's Manual)

## What This App Does
- **Plain English:** This repo is the source of truth for a set of rules, helper scripts, and subagent definitions that keep Claude Code on a tight leash. It is the "hub" that other project repos ("spokes") copy from. It also ships a read-only status page and a local Command Center (`dashboard/`).
- **Public-release status:** Being prepared for public visibility. See `README.md` for the orientation guide and `SECURITY.md` for the local-only safety model.
- Centralized Token-Optimized Claude Code Agent Harness (`claude-harness-hub`).

## Active External Services & Keys
- None required (Zero-API-Cost Gemini Web Clipboard Bridge).

## Current Build Status (updated 2026-11-24)
- **Versions:** engine 3.2.0 (`.harness-version`), thread plugin `plugins/harness` (see its `plugin.json`). `package.json` still says 2.2.0; that number is the dashboard's and is not the engine version.
- **Live in project threads:** the cloud setup script installs the `harness` plugin, which brings `harness:el-architect`, the `harness:gf-*` agents and the hooks. A SessionStart hook refreshes an older installed plugin from the attached hub repo.
- **Guards:** a short list refuses outright (force push, branch delete, deploys, visibility changes, a second `[IN_PROGRESS]` slice, engine-file edits in spokes). Everything else warns and logs an event: PLAN LOCK and SCOPE LOCK warnings reach the model; the fast-path budget, main-thread allow-list and doctor warnings go only to stderr and `.spec/.events/`. Details: `.spec/HARNESS_SPEC.md` section 5.
- **Slices:** `start-slice.mjs` anchors a planned slice, or opens an on-the-fly slice with `--adhoc` after its GitHub Issue exists (Stage 18). `finish-slice.mjs` marks it `[x]` and stamps Referee trailers, plus `Scope-Widened:` and `Main-Thread-Writes:` when they apply. It does not start the next slice.
- **Pull request gate:** one reusable `Harness gate` workflow in the hub that every spoke calls (Slice 19.2). The hub does not call it on its own PRs yet; hub PRs and pushes to main run one workflow, `Harness PR check` (Slice 20.1). A docs-only PR passes without a slice or trailer (Slice 18.13).
- **Slice issues and board:** labels, status from PR events, `/block`, `/needs-me` and similar issue commands, and a GitHub Projects board sync with Capital Case columns (Stages 13 to 17).
- **Stall prevention:** the Stop hook blocks ending a turn while a slice is `[IN_PROGRESS]`, while a PR opened in the session has nothing watching it, while checklist steps are open with nothing to wake the thread, or right after a decision card (Slices 19.1 and 19.196 to 19.205).
- **Telemetry:** per-session event log and a baseline receipt workflow (Slices 11.1 and 19.3).
- **Design system:** the Harness UI kit in `.harness/design-system/` (Slices 18.7 to 18.12).
- **Dashboard:** a read-only status page published by a scheduled Action, and the local Command Center (ADR-011). The React dashboard was retired in Slice 20.242.
- **External co-development:** the Antigravity and AI Studio contract is `.spec/EXTERNAL_AGENT_RULES.md`. Antigravity has landed at least one PR (#172).
- **In Progress:** none.

Earlier milestone notes (v2.0 to v3.2, written as each landed) are in git history for this file and in `.spec/archive/HISTORY.md`.
