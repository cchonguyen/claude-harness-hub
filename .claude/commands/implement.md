---
description: Evaluate complexity threshold and execute the next pending task slice in .spec/PROGRESS.md; chain up to 3 low-risk Green slices
argument-hint: [optional: haiku|sonnet]
allowed-tools: Bash(node *)
---
Tier gate status: !`node "${CLAUDE_PROJECT_DIR:-.}/.harness/scripts/evaluate-upshift.mjs" implement $ARGUMENTS`

0. Stop check: if the tier gate status above begins with `⚠ UPSHIFT_THRESHOLD_REACHED`, STOP immediately without spawning any subagent and output ONLY the `Needed from you:` block printed above. Otherwise, run `git ls-remote --tags origin harness-main-red`; if it prints a line, output `✗ Main is red: fix main first (open issue "RED: main failed checks")` and stop.
1. Anchor: the working tree must be clean. If `.spec/` has uncommitted edits, commit them first. The commit at HEAD is the anchor for this chain.
2. Spawn the subagent specified by the tier gate (`engineer` on Haiku by default, or `engineer-sonnet` ONLY when `/implement sonnet` was explicitly passed) to lock and execute the next pending slice in `.spec/PROGRESS.md`. Keep the slice's colour tag as written.
3. Verify once, after the final edit: run the quick checks from `CLAUDE.md`. For a `[CORE / DATA]` slice, the test rule applies: a test file must change, an assertion must be added or changed, and the test runner must exit 0.
4. Mark the slice `[x]`, update `.spec/SESSION_HANDOFF.md` (keep its `Branch Owner` line), and make the slice its own commit. Push the branch and open or update its PR. Wait for CI on that commit.
5. Local audit: run one scope and assertion check with the `auditor` subagent (Haiku) and `node .harness/scripts/pr-scope-check.mjs`. Any blocking finding stops the chain. (Never silently upshift to Sonnet/Opus for routine slice verification).
6. Chain rule (SYSTEM_SPEC 4.C.4): continue to the next pending slice from step 2 only when all of these hold: the slice is Green; the chain has done fewer than 3 slices; CI is green on the pushed commit; step 5 found no blocking finding; and the milestone is not complete. Otherwise stop.
7. A Yellow or Red slice never chains. A failed check turns the chain Yellow and stops it. Yellow gets one self-remediation attempt, then `git restore --source=<anchor> -- <target files>` and a decision card. When a slice ends Yellow or Red, append a line under `## Pending Rule Candidates — not in force` in `.claude/project-rules.md` (keep at most 10; drop the oldest).
8. At a milestone boundary, update `.spec/OVERVIEW.md`.
9. Output a 1-line receipt per slice (all detailed telemetry is batched in `.spec/STATUS_BATCH.jsonl`). If the chain stopped, add the reason on the same line.
