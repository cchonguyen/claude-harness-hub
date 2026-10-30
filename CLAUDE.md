# Project Context & Harness Dispatcher

@.claude/harness-rules.md

## Work Mode
- No `[IN_PROGRESS]` line in `.spec/PROGRESS.md` = **Vibe Mode**: edit requested files directly, no `/triage` or `/spec` needed.
- One `[IN_PROGRESS]` line = **Slice Mode**: strict single-task lock on that slice's target files.

## Project-Specific Commands
This is the hub repo, so the checks below use Node's built-in runner. Spokes replace this section with their own stack's commands.
Run the quick check once per turn, after the final edit.
- Typecheck: `npm run typecheck --silent` (or `pnpm typecheck --quiet`)
- Unit Tests: `node --test .harness/hooks/lib/runner-matcher.test.mjs`
- Lint: `npm run lint --silent`
