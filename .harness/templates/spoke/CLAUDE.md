# Project Context & Harness Dispatcher

@.claude/harness-rules.md
@.claude/project-rules.md

## Project
- Describe this project here: what it is, the stack, and how to run its checks.

## Work Mode
- No `[IN_PROGRESS]` line in `.spec/PROGRESS.md` = **Vibe Mode**.
- One `[IN_PROGRESS]` line = **Slice Mode**: strict single-task lock on that slice's target files.

## Project-Specific Commands
- Add the quick checks for this project here (typecheck, unit tests, lint).
