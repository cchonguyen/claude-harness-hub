# Plan: harness-consistency
- slice: 19.1
- slice: 19.2
- slice: 19.3

One harness for all of Charlie's repos (5 projects, Claude Code and Antigravity), so every project follows the same work pattern and its work is easy to scan in GitHub. Requested and answered by Charlie, 2026-11-17. He chose this 3-slice version after a critical review of an 8-slice draft. Slice ids continue after 18.13.

## Principles (HARNESS_SPEC section 1, N1 to N6)
Operator directs (N1). Cheapest adequate model and minimal context (N2). No micromanagement: agents resolve clerical problems themselves (N3). Self-driving from repo instructions (N4). Self-auditing, with durable telemetry (N5). Proportionate: no machinery whose cost exceeds its benefit (N6). Added by Charlie: project-agnostic.

## Decisions from Charlie (2026-11-17)
1. Audience: his own 5 GitHub repos, used from Claude Code and Antigravity. Both stay supported.
2. A gate stops work only when something critically needs him. Duplicate slice ids, red tests and missing issues are clerical: the agent, or a workflow, fixes them without asking.
3. One consistent pattern for red checks. Bypassing a check or forcing a merge happens only when Charlie asks, and is rare.
4. Ask Charlie only for: production changes, spend, migrations, and a change to what he asked for. Merging green PRs, picking slice numbers, opening issues and chaining slices never need him.
5. A blocked slice leaves an audit trail someone can triage, not a one-line note.
6. Most repos have branch protection, so the gate can be a required check.
7. Docs-only PRs still need an issue, but skip tests.
8. Telemetry is detailed and kept out of normal work, opened for audits. A missing field is `unknown` with a reason, never blank. Token counts are recorded where the tool provides them.
9. One version everywhere, with no per-repo versions to remember.

## Why these three first (review, 2026-11-17)
- The Global Editions slice bypass happened with the harness plugin loaded. The plan lock warned on stderr (`pre-tool-guard.mjs`), which the model never sees, and the red gate did not block the merge.
- Referee trailers were the main reason honest PRs went red. CI already re-runs the tests on the exact tree.
- No durable telemetry exists, so no later change can be measured without a baseline.
- `stop-guard.mjs` blocks on any `- [ ]` line, including slices of a plan not yet merged.
- A workflow-opened sync PR cannot trigger required checks or edit workflow files, so CI consistency comes from a reusable workflow in the public hub, called at `@main`.

## Slices
Each slice is one pull request, built in order, with its GitHub issue opened first.

- **19.1 Visible warnings and a correct Stop hook.** Soft-gate warnings reach the model through hook context (`additionalContext`) instead of stderr, starting with the plan lock. The Stop hook counts only slices from plans merged on `origin/main`, and only the slice in progress on this branch.
- **19.2 One gate for every repo.** A reusable workflow in the hub, called by every repo at `@main`. It runs the repo's verify commands, checks the PR links an issue (`Closes #N`), and drops the Referee trailer check. A PR labelled `migration` skips the slice checks. When a PR has no issue, the workflow opens one and adds `Closes #N` to the PR body, so nobody has to. Each repo's caller is a few lines and becomes the required check. After 3 failed fixes the agent labels the issue `status:blocked-on-operator` and posts a failure dossier: what was asked, each attempt, the failing output, files touched and the likely cause. A bypass needs Charlie's explicit words and is recorded as `Gate-Bypass` on the PR.
- **19.3 Baseline telemetry.** A Stop hook writes a receipt from the session transcript (model, token counts, tool calls, retries, checks run) with `unknown` plus a reason for anything missing. The agent adds the receipt to the PR body. On merge, a reusable workflow appends it to a `harness-telemetry` branch, which normal checkouts never fetch. A hub script reads all repos' branches into one view for an audit.

## After a week of receipts (not approved by this plan)
Operator profile and per-repo project config, one label set and PR templates, issue numbers as slice ids, and retiring unused components. Each needs its own plan.

## Out of scope
New product features. Any change to a repo's own code.
