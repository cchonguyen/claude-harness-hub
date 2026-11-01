# Antigravity Harness Contract & Scope Rules

## 1. Pre-Flight Inspection
Before modifying files or generating plans:
- Read `CLAUDE.md` (project commands and conventions).
- Read `.spec/SYSTEM_SPEC.md` (data contracts and "Do NOT Build" boundaries).
- Read `.spec/PROGRESS.md` (active `[IN_PROGRESS]` slice).
- Read `.spec/SESSION_HANDOFF.md` (where Claude left off).

## 2. Bounded Execution Boundaries
- If a task in `.spec/PROGRESS.md` is marked `[IN_PROGRESS]`, modify ONLY its designated `Target files:`.
- NEVER modify or delete files inside `.claude/`, `.harness/`, or `.harness-version`.
- Do NOT introduce unrequested npm or Python dependencies.
- Verify code changes with this repo's checks from `CLAUDE.md`, run once after the final edit: `npm run typecheck --silent`, `npm run lint --silent`, and `node --test .harness/hooks/lib/runner-matcher.test.mjs`.
- The full external co-development contract is `.spec/EXTERNAL_AGENT_RULES.md`. This file summarizes it and does not replace it.

## 3. Mandatory Baton Pass (Before Handoff)
Before concluding work:
- Update `.spec/PROGRESS.md` (check off completed tasks or note partial progress).
- Overwrite `.spec/SESSION_HANDOFF.md` with:
  - **Last Active Platform:** Google Antigravity
  - **Active Branch / State:** [Branch name & brief status]
  - **Files Modified in Last Turn:** [List of changed file paths]
  - **Verification Status:** [e.g., "Verified: typecheck, lint, and node --test passed"]
  - **Immediate Next Step for Claude:** [1-sentence directive]
