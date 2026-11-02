# Antigravity Harness Contract & Scope Rules (v3.2)

## 1. Pre-Flight Inspection & Cognitive Mode
Before modifying files or generating plans:
- Read `CLAUDE.md` (project commands and conventions).
- Read `.spec/SYSTEM_SPEC.md` (data contracts, Elephant vs. Goldfish model, and "Do NOT Build" boundaries).
- Read `.spec/PROGRESS.md` (active `[IN_PROGRESS]` slice).
- Read `.spec/SESSION_HANDOFF.md` (where Claude left off).
- Check `.spec/AUDIT_VERDICT.json` for recorded review findings before modifying code.
- If `.spec/STATUS_BATCH.jsonl` has queued events, run `node .harness/scripts/status-batch.mjs digest` to inspect recent activity.
- Cognitive Mode: Antigravity acts as a fast, low-cost Goldfish worker for coding, testing, PR review, and debugging. When planning or architecture is required, invoke the Elephant (Sonnet/Opus spec finalization).

## 2. Bounded Execution Boundaries
- If a task in `.spec/PROGRESS.md` is marked `[IN_PROGRESS]`, modify ONLY its designated `Target files:`.
- **Spoke Repository Protection:** In downstream spoke repositories, NEVER modify or delete files inside `.claude/`, `.harness/`, or `.harness-version`. (When working inside `claude-harness-hub` itself, modifying `.claude/`, `.harness/`, and `.harness-version` is permitted when listed in the active slice's `Target files:`).
- Do NOT introduce unrequested npm or Python dependencies.
- Verify code changes with this repo's checks from `CLAUDE.md`, run once after the final edit: `npm run typecheck --silent`, `npm run lint --silent`, and `node --test .harness/hooks/lib/runner-matcher.test.mjs`.
- If a build or test command fails twice in a row with the same error (2-strike circuit breaker), stop guessing edits and run `node .harness/hooks/pre-tool-guard.mjs --restore` to reset modified files to the slice-start checkpoint (in Slice Mode) or the last known green checkpoint (in Vibe Mode).
- Do not start a new slice while origin has the tag `harness-main-red` (`git ls-remote --tags origin harness-main-red` prints a line). Fixing main is the only work until it is gone.
- The full external co-development contract is `.spec/EXTERNAL_AGENT_RULES.md`. This file summarizes it and does not replace it.

## 3. Mandatory Baton Pass & Neutral Referee Trailers
Before concluding work:
- Update `.spec/PROGRESS.md` (check off completed tasks or note partial progress).
- Use `node .harness/scripts/finish-slice.mjs "<commit msg>"` when committing a completed slice so Git trailers (`Referee-Verdict: VERIFIED`, `Referee-Tree`, `Referee-Engine`) are stamped on the commit.
- Record code review findings in `.spec/AUDIT_VERDICT.json` and post PR review comments with structured verdicts (`CLEAN` or `NEEDS CHANGES`).
- Queue a baton-pass event in the status batch:
  `HARNESS_ACTOR=antigravity node .harness/scripts/status-batch.mjs append baton_pass "<1-line summary>"`
- Overwrite `.spec/SESSION_HANDOFF.md` with:
  - **Last Active Platform:** Google Antigravity
  - **Active Branch / State:** [Branch name & brief status]
  - **Files Modified in Last Turn:** [List of changed file paths]
  - **Verification Status:** [e.g., "Verified: typecheck, lint, and node --test passed (Referee-Verdict: VERIFIED)"]
  - **Immediate Next Step for Claude:** [1-sentence directive, e.g., "Run `/clear` then `/pickup`"]

## 4. Gemini Briefing Agent Protocol (Consolidated Status Updates)
To save Claude tokens, Claude operates in **Silent Batching Mode** (writing 1-line receipts and queuing telemetry into `.spec/STATUS_BATCH.jsonl` instead of narrating in chat).
Whenever a handoff occurs, an upshift threshold is reached, or the operator asks for a status update (`"brief me"`):
1. Spawn a lightweight subagent (`Model: 'flash_lite'` or `'flash'`, Role: `'Status Briefing Agent'`) or run `node .harness/scripts/status-batch.mjs digest`.
2. Consolidate all queued events from `.spec/STATUS_BATCH.jsonl`, `.spec/SESSION_HANDOFF.md`, and `.spec/PROGRESS.md` into a concise, plain-English **Operator Briefing**:
   - **What Happened Under the Hood:** Plain-English summary of completed slices, checkpoints, and verifications.
   - **Upshift / Blocker Advisories:** If an `upshift_advisory` or `circuit_breaker` event is present, explain the exact trade-off (handling it right here in Antigravity for 0% Claude quota vs. authorizing `/implement sonnet` or `/spec opus` in Claude).
   - **Needed From You:** Clear, numbered next steps.
3. Clear the delivered batch by running `node .harness/scripts/status-batch.mjs clear`.

<!-- >>> harness >>> -->
## Harness rules for external agents (managed by the harness; edit in claude-harness-hub)

Before you change this repo, read `.spec/EXTERNAL_AGENT_RULES.md`. It is the full contract.

Rules that always apply:
1. Read `.spec/SESSION_HANDOFF.md` and check `Branch Owner`. Push only to a branch you own. If the owner is someone else, open `antigravity/<slice>` or post a PR review comment instead.
2. Record code review findings in `.spec/AUDIT_VERDICT.json` and post PR review comments with structured verdicts (`CLEAN` or `NEEDS CHANGES`).
3. Never commit or push directly to `main`.
4. Complete slices using `node .harness/scripts/finish-slice.mjs "<msg>"` so Neutral Referee trailers are attached. Run `node .harness/scripts/pr-scope-check.mjs` before PR merges.
5. Do not start a new slice while origin has the tag `harness-main-red` (`git ls-remote --tags origin harness-main-red` prints a line). Fixing main is the only work until it is gone. If repeated build/test failures trigger the 2-strike circuit breaker, restore files with `node .harness/hooks/pre-tool-guard.mjs --restore`.
6. Never merge a PR with a red or missing check.
7. Queue baton-pass updates via `HARNESS_ACTOR=antigravity node .harness/scripts/status-batch.mjs append baton_pass "<summary>"`, and when asked to brief the operator (`"brief me"`), consolidate `node .harness/scripts/status-batch.mjs digest` in plain English using a lightweight Flash/Flash-Lite agent and run `node .harness/scripts/status-batch.mjs clear`.
<!-- <<< harness <<< -->
