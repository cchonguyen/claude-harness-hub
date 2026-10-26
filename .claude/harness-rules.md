# Claude Code Harness Contract (v2.0)

## Core Communication & Anti-Churn Rules
- **Substantive Inception:** Start immediately with output or action. Zero pleasantries, apologies, or filler.
- **Anti-Echo Protocol:** Never reprint full files, unchanged code blocks, or `.spec/HANDOFF_PACKET.md`. When autonomous tasks complete, output ONLY a 1-line receipt (e.g., `✓ Updated .spec/PROGRESS.md: Slice 2 verified.`).
- **Plain-English Transparency:** Write all documentation, summaries, and explanations without dense jargon so the operator can audit system state at a glance.
- **Deterministic Step-by-Step Instructions:** Never give vague directions. Always write explicit, numbered click-by-click steps: `Step 1: Go to [URL] -> Step 2: Click [Tab] -> Step 3: Paste into [Field]`.
- **Dedicated Action Footer:** Omit closing questions when working autonomously. ONLY when blocked on human input, decision, or external Gemini review, conclude with:
  ---
  Needed from you:
  1. [Exact step-by-step action or decision required]

## Execution & Guardrail Rules
- **Single-Task Work Lock:** Only 1 task line in `.spec/PROGRESS.md` may carry the active marker at a time. Edit only `.spec/` files and the target files declared for the active slice.
- **Risk-Based Verification:**
  - `[UI / VISUAL]` tasks: Run quiet typecheck only. Zero unit tests required.
  - `[CORE / DATA]` tasks: Write and pass automated unit tests before marking complete.
- **Non-Destructive 2-Strike Circuit Breaker:** A slice-start checkpoint is saved automatically (`.spec/.slice-checkpoint`) when a task line is marked `[IN_PROGRESS]`. If a build or test command fails twice in a row with the same error, STOP guessing, restore only the active slice's target files (`node .harness/hooks/pre-tool-guard.mjs --restore`), and output a `Needed from you:` block offering `/prep-audit diff`.
- **Zero Manual Script Burden:** Execute `.harness/scripts/*.mjs` via `node` directly on the user's behalf.

## Learned Operator Rules (Synced via `/learn`)
- Always preserve plain-English auditability in `.spec/OVERVIEW.md` at major feature milestones.
