# Boundary Contract: File & Engine Locks (Atlas Sector 210)

Defines immutable and mutable boundaries for agents across hub and spoke repositories.

## 1. Spoke Engine Locks
When operating inside a spoke repository, the following engine paths are strictly locked against modification:
- `.harness/**` — Core deterministic hooks, scripts, and thresholds.
- `.claude/**` — Subagent definitions, commands, settings, and harness rules (except `.claude/project-rules.md`).
- `.harness-version` — Engine version marker.
- `.spec/EXTERNAL_AGENT_RULES.md` — Multi-agent boundary rules.
- `AGENTS.md` (harness block) — Block managed between `>>> harness >>>` and `<<< harness <<<`.

Spoke rules live exclusively in `.claude/project-rules.md`. In spokes, Edit and Write calls on engine paths are refused (exit 2) by `pre-tool-guard.mjs`, Bash writes to them are refused by `hard-blocks.mjs`, and CI scope enforcement fails the PR.

## 2. Active Slice Target Locks
In Manager Mode (`workMode: "manager"`):
- Exactly one slice in `.spec/PROGRESS.md` may be tagged `[IN_PROGRESS]`. A second one is refused (exit 2, WORK LOCK).
- Agents should create or edit only the files listed under `Target files:` for that active slice.
- An edit outside the declared `Target files:` goes ahead with a `SCOPE LOCK` warning (since Slice 12.4). `finish-slice.mjs` then records the file in a `Scope-Widened:` commit trailer, and the pull request should say why.
- With no `[IN_PROGRESS]` slice, a source edit goes ahead with a `PLAN LOCK` warning (since Slice 11.12).

## 3. Scope Neutrality
- Scope definitions are anchored in Git (`HEAD:.spec/PROGRESS.md`). Working-tree modifications cannot retroactively expand slice scope.
- Zero unassigned modifications: agents must never refactor, format, or clean up unassigned files.
