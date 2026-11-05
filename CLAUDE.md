# Harness Hub: rules for Claude Code threads

These rules load into every thread. Repo `.claude/` hooks, agents and commands never load in a project thread. The `harness` plugin brings the agents and hooks instead, installed by the cloud environment's setup script (`plugins/harness/setup-script.sh`).

## Subagents
- Check the Agent tool's list for `harness:gf-coder`. If it is missing, the plugin is not installed: do each step yourself and say so once.
- Slice `[IN_PROGRESS]` with clear `Target files:`: dispatch `harness:gf-coder` with the slice line and the exact verify command. You review its report, then run verification and finish the slice yourself.
- Requirements unclear, `Target files:` unknown, or `.spec/BLACK_BOX.md` exists: dispatch `harness:el-architect`.
- Exploring unfamiliar code: dispatch `harness:gf-navigator`.
- The plugin's hooks enforce a fast-path budget in the main thread: 3 source reads, 1 search, 1 edit of at most 25 lines. A `FAST-PATH BUDGET EXCEEDED` block means delegate. Never work around it with Bash.

## Working style
- Reply with the result first. Use short sentences and no filler.
- Never reprint whole files or unchanged blocks.
- After a finished step, give a one-line receipt that names what changed.
- Read the files you will edit and the tests beside them. Do not survey the whole repo.

## Work modes
- **Slice mode:** `.spec/PROGRESS.md` has exactly one `[IN_PROGRESS]` slice. Edit only its `Target files:`, plus `.spec/PROGRESS.md` and `.spec/SESSION_HANDOFF.md`.
- **Two or more `[IN_PROGRESS]` slices:** stop and ask which one to finish.
- **No slice:** a quick fix changes one file and at most 25 lines. Anything larger needs a slice first, written with `/spec`.
- If a slice's `Target files:` are missing or unclear, ask. Do not guess.

## Verification
Run both before every commit, once after the final edit:
1. `node --test plugins/harness/test/run.test.mjs .harness/hooks/lib/*.test.mjs .harness/scripts/*.test.mjs .harness/scripts/lib/*.test.mjs`
2. `npm run typecheck --silent && npm run lint --silent`

Report the actual output. Do not say a check passed unless you ran it in this session.

If the same test or build fails twice with the same error, stop guessing. List the files you changed and ask before restoring or reverting anything.

Slice colour tags: `[UI / VISUAL]` needs typecheck only. `[CORE / DATA]` needs tests written and passing.

## Finishing a slice
1. Run the verification commands above.
2. Run `node .harness/scripts/finish-slice.mjs "<commit message>"`. It marks the slice `[x]`, stamps the `Referee-Verdict` and `Referee-Tree` trailers, and commits. Never type those trailers by hand.
3. Push and open the pull request (see below).

## Git and pull requests
- Branch from `main`. Name the branch `claude/<short-topic>`. Never push to `main` directly.
- Once the operator approves an implementation, commit, push and open a pull request without asking again.
- Do not merge, deploy, force-push, delete branches, close or reopen pull requests, or change repository visibility without the operator's explicit yes for that action.
- Before asking the operator who merged a pull request, check the merge record on GitHub (merger and merge time). Ask only when the record does not show it. Never ask about a merge the operator has already made.
- Put the typecheck, lint and test results in the pull request description.
- The `Harness slice gate` check must pass. It needs a slice line in `.spec/PROGRESS.md` and a head commit with Referee trailers. A quick fix or a vibe-mode change will show red, by design.
- Use the pull request template if the repo has one.

## Web-first operation
- Run scripts, tests and git yourself in the cloud container. Do not ask the operator to run them.
- When the operator must act, write numbered steps for the Claude Code web app: the page, the button, the field, and the expected result after each step.
- Only when the container truly cannot do a task, offer one self-contained terminal command as the last resort.
- Engine files (`.claude/`, `.harness/`, `.harness-version`) change in this hub repo only. Spokes get them by sync.

## When blocked
Finish everything that does not depend on the blocker first. Then end your reply with a `Needed from you:` block of numbered, concrete steps. Put nothing after it.

## Dashboard and slice tracking (required)
Run these from the repo root, with the `bin/` paths. Run them without asking. The main thread and `harness:gf-coder` both run them.
1. Slice start: `node bin/update-state.mjs --slice-id <id> --slice-title '<title>' --intent '<goal>' --stage Implementation`
2. Blocker or human decision: `node bin/update-state.mjs --add-decision '<id>:<question>:<contextFile>'`. Keep working on anything that does not depend on it.
3. Coding complete: run `bin/verify-slice.sh`. It sets `Claimed` when it starts and `Verified` on a pass. Never set `Verified` or `Accepted` by hand.
4. Acceptance is the one human gate. End with a one-line receipt asking the operator to click "Accept Verified Slice" at http://127.0.0.1:3456/ (or run `bin/accept-slice.sh`).
The verify secret lives only on the operator's machine, so `verify-slice.sh` stops at once in the cloud. That is by design: a secret in the cloud would let an agent set `Accepted`.
