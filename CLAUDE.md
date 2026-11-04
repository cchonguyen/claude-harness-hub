# Harness Hub: rules for Claude Code threads

These rules load into every thread. Hooks, subagents and agent-only slash commands do not run in a thread, so do each step yourself, in this session.

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
1. `node --test .harness/hooks/lib/*.test.mjs .harness/scripts/*.test.mjs .harness/scripts/lib/*.test.mjs`
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
