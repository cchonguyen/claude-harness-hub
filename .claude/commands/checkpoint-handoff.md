---
description: Save a 5-line handoff so a heavy session can close and resume fresh with no lost progress
allowed-tools: Read, Write, Edit, Bash(git branch*), Bash(git status*)
disable-model-invocation: true
---
1. Read `.spec/PROGRESS.md`. If a slice is `[IN_PROGRESS]` and its work is verified, mark it `[x]`. If the status line is stale in any other way, correct it. Otherwise leave it alone.
2. Overwrite `.spec/SESSION_HANDOFF.md` with exactly these 5 lines:
   - `Branch: <output of git branch --show-current>`
   - `Last passing test: <command and result of the last green test or build this session, or "none this session">`
   - `Slice state: <the [IN_PROGRESS] slice line, or "none (Vibe Mode)">`
   - `Uncommitted changes: <yes or no, from git status --short>`
   - `Next step: <the single immediate next action>`
3. Output this prompt for the new session, copied exactly:
   `"Resume work on this project. Read .spec/SESSION_HANDOFF.md and confirm our next slice. Do NOT edit files until confirmed."`
4. Output this receipt only: `✓ Checkpoint saved. Safe to close this session and start fresh.`
