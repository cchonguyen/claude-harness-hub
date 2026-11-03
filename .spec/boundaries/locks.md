# Boundary Contract: File & Engine Locks (Dewey 210)

Defines immutable and mutable boundaries for agents across hub and spoke repositories.

## 1. Spoke Engine Locks
When operating inside a spoke repository, the following engine paths are strictly locked against modification:
- `.harness/**` — Core deterministic hooks, scripts, and thresholds.
- `.claude/**` — Subagent definitions, commands, settings, and harness rules (except `.claude/project-rules.md`).
- `.harness-version` — Engine version marker.
- `.spec/EXTERNAL_AGENT_RULES.md` — Multi-agent boundary rules.
- `AGENTS.md` (harness block) — Block managed between `>>> harness >>>` and `<<< harness <<<`.

Spoke rules live exclusively in `.claude/project-rules.md`. In spokes, any attempt to modify engine paths is rejected by pre-tool hooks and CI scope enforcement.

## 2. Active Slice Target Locks
In Manager Mode (`workMode: "manager"`):
- Exactly one slice in `.spec/PROGRESS.md` may be tagged `[IN_PROGRESS]`.
- Agents may ONLY create or edit files explicitly listed under `Target files:` for that active slice.
- Edits outside the declared `Target files:` are blocked by `pre-tool-guard.mjs` and rejected by `referee.mjs` / `finish-slice.mjs`.

## 3. Scope Neutrality
- Scope definitions are anchored in Git (`HEAD:.spec/PROGRESS.md`). Working-tree modifications cannot retroactively expand slice scope.
- Zero unassigned modifications: agents must never refactor, format, or clean up unassigned files.
