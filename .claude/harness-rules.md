# Claude Code Harness Contract (v2.0)

## Core Communication & Anti-Churn Rules
- **Substantive Inception:** Start immediately with output or action. Zero pleasantries, apologies, or filler.
- **Anti-Echo Protocol (always):** Never reprint full files, unchanged code blocks, or `.spec/HANDOFF_PACKET.md`.
- **1-Line Receipts (slash commands only):** When an autonomous slash command (`/init-harness`, `/triage`, `/spec`, `/implement`, `/prep-audit`, `/ingest-feedback`, `/sync-harness`, `/learn`) completes, output ONLY a 1-line receipt (e.g., `✓ Updated .spec/PROGRESS.md: Slice 2 verified.`). Normal conversational questions get clear, natural answers.
- **Plain-English Transparency:** Write all documentation, summaries, and explanations without dense jargon so the operator can audit system state at a glance.
- **Deterministic Step-by-Step Instructions:** Never give vague directions. Always write explicit, numbered click-by-click steps: `Step 1: Go to [URL] -> Step 2: Click [Tab] -> Step 3: Paste into [Field]`.
- **Dedicated Action Footer:** Omit closing questions when working autonomously. ONLY when blocked on human input, decision, or external Gemini review, conclude with:
  ---
  Needed from you:
  1. [Exact step-by-step action or decision required]

## Work Modes (read from `.spec/PROGRESS.md`)
- **Vibe Mode (no `[IN_PROGRESS]` slice, or no `.spec/PROGRESS.md`):** Edit the requested files directly. Do NOT require `/triage` or `/spec` first. The harness snapshots the working tree at session start and advances a "last known green" checkpoint every time a test or build passes (lint and typecheck passes do not move it).
- **Slice Mode (exactly 1 `[IN_PROGRESS]` slice):** Strict single-task lock. Edit only `.spec/` files and the slice's declared `Target files:`. A slice-start checkpoint (`.spec/.slice-checkpoint`) is saved automatically when the line is marked `[IN_PROGRESS]`.
- **2+ `[IN_PROGRESS]` slices:** Edits are blocked. Keep only 1 active slice (or clear them all for Vibe Mode).

## Execution & Guardrail Rules
- **Verification in Vibe Mode:** Run the project's quick check from `CLAUDE.md` (`Project-Specific Commands`) **once per turn, after the final edit**, with quiet flags (`pytest -q --tb=short`, `ruff check --quiet`, `vitest run --reporter=dot`). Do not re-run it after every single file edit.
- **Risk-Based Verification (Slice Mode):**
  - `[UI / VISUAL]` tasks: Run quiet typecheck only. Zero unit tests required.
  - `[CORE / DATA]` tasks: Write and pass automated unit tests before marking complete.
- **Non-Destructive 2-Strike Circuit Breaker:** If a build or test command fails twice in a row with the same error, STOP guessing and run `node .harness/hooks/pre-tool-guard.mjs --restore`:
  - Slice Mode: restores only the active slice's target files to the slice-start checkpoint.
  - Vibe Mode: restores every changed file (outside `.spec/`, `.claude/`, `.harness/`) to the last known green checkpoint. If nothing has passed yet this session, it only lists the changed files; offer that restore to the user instead.
  Then output a `Needed from you:` block offering `/prep-audit diff`. Missing tools or dependencies (exit 127, `command not found`, `No module named`) are not strikes: install the project dependencies and re-run.
- **Exploration Hint:** When you cannot locate the relevant code within 2 searches, delegate exploration to the `discovery` subagent (Haiku) or built-in Explore agent rather than reading large numbers of unfamiliar files into main context.
- **Zero Manual Script Burden:** Execute `.harness/scripts/*.mjs` via `node` directly on the user's behalf.

## Web-First Execution
- Run all scripts, tests, and git operations yourself in the Cloud container. Never ask the operator to run something you can run.
- When blocked, tell apart the two kinds of help and use the step-by-step `Needed from you:` format for both:
  - **Cloud Settings Click (preferred):** something the operator fixes in the Claude web UI, e.g. attaching a second repo to the session, allowing a network host, adding an environment secret.
  - **True Terminal Fallback (last resort):** only when the Cloud container physically cannot do it (another account's credentials, interactive OAuth, local hardware). Give one self-contained copy-paste command.

## Learned Operator Rules (Synced via `/learn`)
- Always preserve plain-English auditability in `.spec/OVERVIEW.md` at major feature milestones.
