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
- **Built, tests pass, live CI not yet run:** Slice 3.2 (CI gate). `pr-scope-check.mjs` now has Red tripwires, the test-assertion rule, and a `--strict` mode that spokes use to block a PR. Spoke workflow templates are in `.harness/templates/workflows/`. Hub-sync does not copy them into spokes yet.
- **Not confirmed:** whether the live hooks wrote the slice checkpoint in this hub session. A scratch copy does write it, so the live hook did not run for that edit, and that is still open. It happened again for Slice 3.2.
- **Built, tests pass, live spoke check not yet run:** Slice 3.3 (guard). Spokes in Manager Mode block source edits until a task is marked in progress (PLAN LOCK). Harness files, `.spec/harness.json`, and the AGENTS.md harness block are locked in spokes. The colour tag of an active slice is frozen. A Bash write tripwire blocks commands that write to harness files. A file is judged by its own git repo.
- **Built, tests pass, live check not yet run:** Slice 3.4 (commands and relay). `/implement` chains up to 3 Green slices and stops on any failure. `/quick-fix` makes a one-file change in Manager Mode. Session start warns when main is red and shows the Branch Owner. `/learn promote` moves a candidate rule into force. The external-agent rules now cover main-red and red checks.
- **Built, tests pass, live check not yet run:** Slice 3.5 (release). The test-runner list adds Go, Cargo, Python `-m` test runners, and `make test`. The handoff diff leaves lockfiles out and names them in a note. Harness version is 3.0.0.
- **Milestone status:** Harness v3.0 "Manager Mode" slices 3.0 to 3.5 are built, each in its own PR. The live check in a real spoke session is still open, and so is the live checkpoint file, which has not appeared in any hub session.
- **Up Next:** Live check in a spoke set to Manager Mode, then decide on the deferred `checks` list in `.spec/harness.json`
