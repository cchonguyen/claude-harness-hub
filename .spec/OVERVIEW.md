# Project Overview (Owner's Manual)

## What This App Does
- Centralized Token-Optimized Claude Code Agent Harness (`claude-harness-hub`).

## Active External Services & Keys
- None required (Zero-API-Cost Gemini Web Clipboard Bridge).

## Current Build Status
- **Live & Verified:** Core v2.0 Harness Scaffolding; Vibe Mode (edit freely when no slice is active, auto-checkpoint at session start, "last known green" restore), Python test/lint support, hub sync from an attached sibling repo
- **Written, not yet tested live:** Unified external co-development protocol. When Claude Code hits its usage limit, Google Antigravity (terminal-capable) or Google AI Studio (web-only) takes one bounded task through GitHub. The canonical contract is `.spec/EXTERNAL_AGENT_RULES.md`. `.spec/AI_STUDIO_RULES.md` is an alias for it. All platforms share the handoff format in `.spec/SESSION_HANDOFF.md`, and Claude ingests external branches only after it verifies them.
- **Live & Verified:** Operator dashboard (React app, `npm run dev`) showing harness commands, agents, specs, and copy-paste prompts for Claude and Google AI Studio.
- **In Progress:** None
- **Designed, not built:** Harness v3.0 "Manager Mode". New projects require a planned task before code changes (a one-step `/quick-fix` covers small tweaks), Claude can run up to 3 low-risk tasks in a row, risky changes always stop for you, and an automatic check flags broken pull requests and a broken main branch. Full contract in `.spec/SYSTEM_SPEC.md` section 4.
- **Built, tested on scratch copies:** Slice 3.0 (smoke check, `cchonguyen/charliechonguyen.com#7`) and Slice 3.1 (hub-sync now respects file ownership: hub-owned files refresh, spoke files are never touched, settings and blocks merge, and a first sync backs up anything it replaces).
- **Not confirmed:** whether the live hooks wrote the slice checkpoint in this hub session. A scratch copy does write it, so the live hook did not run for that edit, and that is still open.
- **Up Next:** Slice 3.2 (CI gate for spokes)
