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
- Verify all code changes using the project's quiet test suite (`pytest -q` or `vitest run --reporter=dot`).

## 3. Mandatory Baton Pass (Before Handoff)
Before concluding work:
- Update `.spec/PROGRESS.md` (check off completed tasks or note partial progress).
- Overwrite `.spec/SESSION_HANDOFF.md` with:
  - **Last Active Platform:** Google Antigravity
  - **Active Branch / State:** [Branch name & brief status]
  - **Files Modified in Last Turn:** [List of changed file paths]
  - **Verification Status:** [e.g., "Verified: pytest passed (0 errors)"]
  - **Immediate Next Step for Claude:** [1-sentence directive]
