# Plan: harness-consistency
- slice: 19.1
- slice: 19.2
- slice: 19.3
- slice: 19.4
- slice: 19.5
- slice: 19.6
- slice: 19.7
- slice: 19.8

One harness for all of Charlie's repos (5 projects, Claude Code and Antigravity), so every project follows the same work pattern and its work is easy to scan in GitHub. Requested and answered by Charlie, 2026-11-17. Slice ids continue after 18.13.

## Principles (HARNESS_SPEC section 1, N1 to N6)
Operator directs (N1). Cheapest adequate model and minimal context (N2). No micromanagement: agents resolve clerical problems themselves (N3). Self-driving from repo instructions (N4). Self-auditing, with durable telemetry (N5). Proportionate: no machinery whose cost exceeds its benefit (N6). Added by Charlie: project-agnostic.

## Decisions from Charlie (2026-11-17)
1. Audience: his own 5 GitHub repos, used from Claude Code and Antigravity. Both stay supported. One consistent harness, easy to switch between projects, work easy to scan in GitHub.
2. Gates stop work only when something critically needs him. Duplicate slice ids, red tests and missing issues are clerical: the agent fixes them without asking.
3. One consistent pattern for red checks. Bypassing a check or forcing a merge happens only when Charlie asks, and is rare.
4. Ask Charlie only for: production changes, spend, migrations, and a change to what he asked for. Merging green PRs, picking slice numbers, opening issues and chaining slices never need him. The 3-slice auto-chain cap is removed while checks stay green.
5. A blocked slice leaves an audit trail someone can triage, not a one-line note.
6. The repos have branch protection, so the slice gate becomes a required check. No bot-merge machinery.
7. Slices are the ideal everywhere, but they keep getting bypassed. No tool can guarantee an agent uses a slice, so a missing slice never stops work. It is recorded and measured instead (see 19.2).
8. Docs-only PRs still need an issue, but skip trailers and tests.
9. Telemetry lives in one place, kept out of the way of normal work and opened on demand for audits. A missing field is recorded as `unknown` with a reason, never left blank. Token counts are recorded where the tool provides them.
10. One version everywhere. Every repo runs the latest hub `main`, with no per-repo versions to remember and no canary period.
11. Question 7 of the first round (where project rules live) was not answered. Default taken: a profile file for the operator and a small config file per repo.

## Layers
- Engine: hub scripts, hooks, agents, one generic rules page. Names no project and no person.
- Operator profile: `.harness/profile.md`, Charlie's standing rules (no terminal, merge when green, plain-English receipts).
- Project config: `.harness/project.json` in each repo (verify commands, project label, migration rules).

## Slices
Each slice is one pull request. Build in order. Every slice opens its GitHub issue first.

- **19.1 Three layers.** Move project and personal rules out of the hub `CLAUDE.md` into `profile.md` and `project.json`. The engine reads both. Concert-Tracker gets its real verify commands. Strict slices become the rule everywhere, so the quick-fix path goes away. Tests cover the reader.
- **19.2 Clerical self-healing.** Add a `preflight` script every agent runs before a PR. It renumbers duplicate slice ids, reports a missing `Issue: #N` or `Closes #N` with the exact fix, and checks a plan's ids are unused. The slice gate checks the same things, with fixes written for the agent. A PR with no slice is allowed through with an `unsliced` label, so it never stops work, and the telemetry counts it. Docs-only PRs need an issue only.
- **19.3 Red-check pattern and audit trail.** One loop in the rules page: read the failing check, fix, push, up to 3 tries. Then the agent labels the issue `status:blocked-on-operator` and posts a failure dossier: what was asked, what was tried each time, the failing check output, files touched and the likely cause. An agent never offers a bypass. A bypass needs Charlie's explicit words and is recorded as a `Gate-Bypass` line on the PR.
- **19.4 Durable telemetry.** Each slice PR carries a machine-readable receipt (slice id, model, token counts where available, retries, check results, time to green, bypass and unsliced flags, `unknown` plus a reason for anything missing). A workflow appends receipts to a `harness-telemetry` branch in each repo, which normal checkouts never fetch. A hub script reads all branches into one view when an audit needs it. Warnings that matter reach the model through hook context, not stderr.
- **19.5 Scannable GitHub pattern.** One label set, issue and PR templates, PR title format `slice N.M: <title>`, status labels set by workflows, and one saved search for "blocked on Charlie" across the repos. Installed by sync in every repo. The `labels.json` project map comes from each repo's `project.json`. The slice gate becomes a required status check in each repo.
- **19.6 One version, delivery and parity.** A scheduled workflow in each repo pulls the latest hub engine and opens a sync PR that merges when green. A check named "harness current" goes red when a repo is behind. Hub CI runs every repo's gate against a proposed hub change before it merges. The setup script fails loudly. A parity test confirms Claude Code and Antigravity load the same rules page.
- **19.7 Cut to proportion.** Retire components with no use in the last two weeks: duplicate agent copies, Atlas sector numbering, Referee engine hashes (approved for removal 2026-11-06, slice 11.11), unused dashboards. The exact list is in the slice's pull request.
- **19.8 Rollout.** The 19.6 sync PRs reach every repo; Concert-Tracker is first only by ordering. Compare a week of receipts against the week before.

## Out of scope
New product features. Any change to a repo's own code.

## Note on central telemetry
Every repo writing to a branch in one hub repo would need a token added to all 5 repos. Per-repo branches read together by a hub script give one place to look without any secret. If Charlie prefers a true central store, add it later as a separate slice.
