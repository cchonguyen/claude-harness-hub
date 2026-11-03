# Protocol Contract: Structured Review Relay (Dewey 340)

Defines structured code review exchange, audit verdicts, and pull request gating.

## 1. Structured Review Registry (`.spec/AUDIT_VERDICT.json`)
Reviews and audits across platforms are serialized into `.spec/AUDIT_VERDICT.json`:
- Machine-readable schema containing verdict, timestamp, commit SHA, and findings list.
- Each finding carries category, severity (`CRITICAL`, `WARNING`, `ADVISORY`), file path, line numbers, and actionable remediation notes.
- Eliminates ambiguous natural language reviews across agent boundaries.

## 2. Structured Verdict Semantics
- **CLEAN**: No scope violations, all required assertions present, no red tripwires, tests passing. Downstream agents may proceed to merge or advance slice queue.
- **NEEDS CHANGES**: Contains blocking findings. Downstream agent must resolve findings within declared slice targets or request Elephant triage.

## 3. PR Scope Check Gate (`pr-scope-check.mjs`)
- Enforces scope constraints on PR diffs:
  - Verifies modified files match the active slice's `Target files:`.
  - Blocks modifications to engine paths in spokes.
  - Enforces test assertion rules for `[CORE / DATA]` slices.
  - Trips on Red tripwires (dependencies, migrations, auth, deletions).
- In spoke repositories, `pr-scope-check.mjs` exits with code 1 on violations to block CI.
