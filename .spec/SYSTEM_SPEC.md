# System Specification & Contracts

> **Read first:** this file records design contracts and their history. For what actually runs today (plugin 0.3.0, soft gates, hard blocks, host constraints), see [HARNESS_SPEC.md](HARNESS_SPEC.md). Its section 14 lists where the two disagree.

## 1. Core Scope & MVP Boundaries

### Scope Brief (triaged 2026-11-12: bug fixes and ad hoc work create a slice)
- **Core User Problem:** Today a change outside a slice must fit the one-file, 25-line `/quick-fix` path or wait for `/spec`. A real bug or an ad hoc request that is bigger than that is refused or pushed through planning, which costs approvals and time.
- **MVP Deliverables:**
  1. A bug fix or ad hoc request can open a slice on the fly: an `[IN_PROGRESS]` line in `.spec/PROGRESS.md` with `Target files:`, written through the existing `start-slice.mjs` scope-bypass path. The slice then follows the normal slice gate (PLAN LOCK scoped to its targets, Referee trailers on finish).
  2. `/quick-fix` stays for one-file changes. `/spec` stays for planned multi-slice work.
  3. Close the `/quick-fix` contract gap: SYSTEM_SPEC 4.A.2 says the command marks the slice `[x]` in one turn, but `.claude/commands/quick-fix.md` step 4 writes `[IN_PROGRESS]`. Settle which one is correct as part of this work.
- **Owner decisions (answered 2026-11-12):**
  1. Every on-the-fly slice opens a GitHub Issue (labels `slice`, `status:backlog`, project label) and writes `Issue: #N` on its line, the same as a `/spec` slice.
  2. An on-the-fly slice counts toward the one-active-slice limit. 2+ `[IN_PROGRESS]` lines still block edits.
- **Contract:** section 4.A.6 below. Decision: ADR-012. Plan: `.spec/plans/on-the-fly-slices.md` (Slices 18.1 to 18.3).
- **Affected surfaces (estimate, superseded by the plan's Target files):** `.harness/hooks/pre-tool-guard.mjs`, `.harness/hooks/lib/guard-rules.mjs`, `.harness/config/thresholds.json`, `.harness/scripts/start-slice.mjs`, `.claude/commands/quick-fix.md`, `CLAUDE.md` and `.claude/harness-rules.md` (No-slice rule), `.spec/SYSTEM_SPEC.md` 4.A.1 and 4.A.2, plus matching tests. About 8 files, so this is cross-module and changes a contract.

### Scope Brief (triaged 2026-11-11: slice tracking in GitHub Issues and Linear)
- **Core User Problem:** Slice status (backlog, in progress, awaiting approval, done) lives only in `.spec/PROGRESS.md`. The owner wants it mirrored into GitHub Issues so a Linear kanban board can show it, without hand-maintained drift.
- **MVP Deliverables (research and recommendation first; a build follows the owner's decision):**
  1. A research memo comparing the mirror options (one-way from PROGRESS.md to Issues, then Linear through its GitHub integration or a sync the owner runs), with a status mapping table.
  2. A gap audit of the existing slice record. PROGRESS.md has 56 slice lines: 43 carry `- [x]` and 13 have no checkbox (10.4 to 10.9, 11.1, 11.13 to 11.15, 11.16a, 11.17), so their status is not machine-readable. Slice IDs 10.7 and 11.9 each appear twice with different targets, which breaks a stable Issue key. There are no `- [ ]` or `[IN_PROGRESS]` lines today. `finish-slice.mjs` (about line 276) strips `[IN_PROGRESS]` and leaves unboxed lines, which is the likely cause.
  3. Grilling questions the owner answers before any build.
- **Decisions still open:** source of truth (recommended: PROGRESS.md on `main`, with ADR-011 deriving state from PRs and checks); sync direction (recommended: one-way); whether "awaiting approval" maps to the existing accept-plan flow or a new label; whether Issues live in the hub, in each spoke, or both; whether to renumber the duplicate 10.7 before any Issue keys exist; backfill of finished slices or new slices only; Linear's native GitHub integration or a sync the owner controls.

### Scope Brief (triaged 2026-11-03: making the repo public)
- **Core User Problem:** The owner needs to switch this repository from private to public without leaking private data, and needs a repo that a stranger can understand and run within minutes.
- **MVP Deliverables:**
  1. A public-readiness audit with a go/no-go list, plus sanitized files (no personal paths, no private repo names, no local-only settings).
  2. A plain-English `README.md`, a `SECURITY.md`, and a recorded license decision.
  3. A step-by-step visibility-switch guide for the owner, covering every GitHub setting the owner must change.
- **Decisions (resolved 2026-11-03):** License is MIT. Old commit emails are accepted as-is, not rewritten.

### Existing core scope
- Provide deterministic hooks, model-routed subagents, and zero-cost Gemini audit handoffs.
- **Gemini Bridge reference inlining:** in `spec` mode, `bundle-handoff.mjs` scans `.spec/SYSTEM_SPEC.md` (and `.spec/OVERVIEW.md`) for local Markdown links, resolves the ones that exist inside the repository, and inlines their contents under an `# APPENDED REFERENCES` section of `.spec/HANDOFF_PACKET.md`. Links outside the repo root, URLs, and missing files are skipped.

## 2. Strictly Out of Scope ("Do NOT Build" List)

### On-the-fly slice do-not-build (2026-11-12)
- No weakening of PLAN LOCK for source edits outside a slice, or of the engine lock on `.harness/**` and `.claude/**`.
- No change to the Red tripwires (SYSTEM_SPEC 4.C.2) or to the hard blocks in `hard-blocks.mjs`.
- No hand-stamped or `--bootstrap` Referee trailers. The no-bootstrap rule stays.
- No change to the 3-slice auto-chain ceiling or the main-red stop.
- No change to music-visualizer, where every change stays a slice.
- No new work mode, dashboard, or per-fix workflow.

### Slice-tracking do-not-build (2026-11-11)
- No writes to GitHub Issues, Linear, or any remote during research.
- No change to hook, `finish-slice`, referee, or `PROGRESS.md` behavior or format in this step.
- No deletion or renumbering of `PROGRESS.md` entries before the owner decides on the ID scheme.
- No new workflow until the owner picks a source of truth and a sync model.
- No Linear as source of truth, and no new dashboard.

### Public-release do-not-build
- No change to hook, script, or dashboard behavior in this release.
- No git history rewrite or force push without the owner's explicit approval.
- No visibility, branch protection, or secret changes made through the API. The owner changes visibility in GitHub's settings.
- No authentication layer for the dashboard. The only hosted surface is the read-only status page published by `.github/workflows/status-snapshot.yml` (ADR-011). It has no write path and no token in the page.
- No new features, slices, or dependency changes.

### Existing boundaries
- No paid external API calls inside hooks.
- No external npm dependencies inside `.harness/`.
- No symlinks outside the repository root.
- No printing raw handoff bundles or file contents to stdout. `/prep-audit` outputs a single-line receipt pointing to `.spec/HANDOFF_PACKET.md`.
- No `git remote add` during spoke bootstrap. Remotes vanish when a Cloud container restarts; spokes sync by copying from a sibling checkout.

## 3. Data Models & Module Boundaries
- `.claude/`: Subagents, commands, settings, and `harness-rules.md`.
- `.harness/`: Zero-dependency Node.js hooks and scripts.
- `.spec/`: Project state and specification artifacts.

### Spoke Connection Contract
1. **Hub pointer:** every spoke commits `.harness/hub.json`, e.g. `{ "repo": "claude-harness-hub", "owner": "cchonguyen", "branch": "main" }`.
2. **Discovery:** `hub-sync.mjs` looks for a sibling checkout at `../<repo>` (the layout a Cloud container uses when both repos are attached to the session). If none is found, it prints a `HUB_NOT_ATTACHED` error with the settings steps to attach the hub repo, and exits without changing anything. An existing `harness-hub` git remote is honoured as a fallback but is never created.
3. **Sync boundary:** sync overwrites only engine files (`.claude/`, `.harness/`, `.harness-version`). Project-owned files (`.spec/`, root `CLAUDE.md`) are never overwritten by sync. The one exception is the spoke templates listed in `TEMPLATE_PATHS` in `hub-sync.mjs` (currently `.spec/AI_STUDIO_RULES.md`). Sync copies those only when the spoke does not already have the file, so a spoke's local edits are kept.

### Vibe Mode Checkpoint Rule
- The "last known green" checkpoint advances only when a command that executes code passes: test runners (`vitest`, `jest`, `pytest`, `node --test`, `npm|pnpm|yarn|bun test`) or a build (`npm|pnpm|yarn|bun run build`).
- Static checks (`eslint`, `ruff check`, `ruff format --check`, `mypy`, `pyright`, `tsc`, `typecheck`, `lint` scripts) still count toward the circuit breaker and still get their output scrubbed, but a pass never advances the checkpoint. Lint-clean code can still be logically broken, and locking it in would make a restore land on a regression.
- If a project has no test or build command, no checkpoint ever advances; `--restore` then only lists the changed files, as it does before the first pass.

### Dashboard State Sources (ADR-011)
The dashboard derives state and never reads agent-written state files. Its sources are:
- **`PROGRESS.md` on `origin/main`:** slices, order, targets, and the `Merged` suffix.
- **GitHub pull requests and check runs:** slices in progress, work pushed but not on `main`, and CI results.
- **Merge records:** the merger and the merge time.
- **Local Herdr panes:** local liveness only. Remote work does not use them.

The hosted status page reads only the published `status.json`. The local Command Center reads the same derived state on port 3456. Each card shows its source and age, and disagreements between sources are listed, not resolved silently. See [ADR-011](DECISIONS.md).

## 4. Harness v3.0 "Manager Mode" Contract (locked 2026-11-01, not yet built)
Source: Claude review of the v3.0 RFC, operator decisions, and the Antigravity adversarial review (ADR-008). Build order is in `.spec/PROGRESS.md` (Slices 3.0 to 3.5). Until those slices ship, sections 1 to 3 above describe what actually runs.

### 4.A Work modes and engine lock
1. **Mode switch.** Spoke-owned `.spec/harness.json` holds `{ "workMode": "manager" | "vibe" }`. `hub-sync.mjs init` writes `manager`. A spoke with no file keeps `vibe`, so v2.2 spokes do not change behavior on upgrade. In `manager`, 0 `[IN_PROGRESS]` slices blocks edits outside `.spec/` with `PLAN LOCK: No task is marked [IN_PROGRESS] in .spec/PROGRESS.md. Run /triage or /spec first.` `modeOf()` returns `'locked'` for that case. As built, the lock is a warning (HARNESS_SPEC section 5) and the `plan_lock_warn` event is logged. From Slice 18.3 the warning text is `WARN: PLAN LOCK: No task is marked [IN_PROGRESS] in .spec/PROGRESS.md. Run /spec, or open an on-the-fly slice: node .harness/scripts/start-slice.mjs --adhoc (see CLAUDE.md, Work modes).` Only the text changes. The lock does not get weaker, and it is satisfied only by a real `[IN_PROGRESS]` line.
2. **`/quick-fix <file> <change>`** is a one-file on-the-fly slice (4.A.6) closed in the same turn. It refuses when the file matches a Red tripwire path (4.C.2) or an engine path, when main is red, or when a slice is already `[IN_PROGRESS]`. Then it opens the issue, runs `start-slice.mjs --adhoc --tag ui --targets <file>` (which writes the `[IN_PROGRESS]` line and the anchor commit), edits that file, runs the quick checks once, and runs `finish-slice.mjs "<msg>"`, which marks the line `[x]` and stamps the Referee trailers. **Settled 2026-11-12 (ADR-012):** `[IN_PROGRESS]` is a short-lived state inside the turn, and the slice ends `[x]` in the same turn. Both earlier texts were partly right. The real defect was that `quick-fix.md` marked `[x]` by hand and used a `QF-N` ID that `parseSliceLine`, `finish-slice.mjs` and `--restamp` cannot read, so a quick fix never got Referee trailers and its PR showed red. `QF-N` numbering is retired. Old `QF-N` lines stay as history. The `[GREEN]` colour tag is not written, because current slice lines carry no colour.
3. **Engine lock in spokes, every mode.** Blocked: `.harness/**`, `.harness-version`, `.claude/settings.json`, `.claude/agents/**`, `.claude/commands/**`, `.claude/harness-rules.md`, `.spec/EXTERNAL_AGENT_RULES.md`, and the harness block inside `AGENTS.md`. Spoke rules live in spoke-owned `.claude/project-rules.md`, imported from `CLAUDE.md` with `@.claude/project-rules.md`. Hub detection uses the `origin` URL only; the folder basename and `hub.json` checks are dropped because an agent can change them.
4. **Slice anchor.** `pre-tool-guard.mjs` keeps the fast local `refs/harness/slice-checkpoint` capture (PreToolUse runs before the edit lands, so it never commits or pushes). The durable anchor is a git commit: `/implement` requires a clean working tree before the first slice of a chain (committing pending `.spec/` edits first), and each finished slice is its own commit, so commit N-1 is the anchor for slice N. `--restore` falls back to that commit when the local ref is missing. Antigravity restores with `git restore --source=<anchor> -- <target files>`.
5. **Bash write tripwire.** A new PreToolUse hook on `Bash` blocks commands that write to engine paths or `AGENTS.md`: redirects `>` and `>>`, `tee`, `cp`, `mv`, `rm`, `sed -i`, `perl -i`, `python -c`, `node -e`, `git checkout --`, `git restore`. It is a speed bump only; CI (4.C.3) is the real wall.
6. **On-the-fly slices (bug fixes and ad hoc work, 2026-11-12, ADR-012).** A thread that meets a bug or an ad hoc request bigger than the no-slice quick fix (one file, at most 25 lines) opens a slice itself and works under the normal slice gate.
   - **When:** the operator asks for the change in the thread, or a bug blocks the work at hand. The operator's request is the approval for that one slice. No plan file, `/spec`, or extra approval round is needed. Planned multi-slice work still uses `/spec` and a plan file.
   - **Not allowed (use `/spec`):** 5 or more target files; any target that matches a Red tripwire (4.C.2); in a spoke, any engine-locked path (4.A.3); while main is red; while a slice is already `[IN_PROGRESS]` (the one-active-slice limit applies, and 2+ active lines still block edits).
   - **Open, step 1 (issue):** open one GitHub Issue with the GitHub MCP `issue_write` tool. Labels: `slice`, `status:backlog`, the project label, and `gate-change` when the slice changes a gate. The title is free text, because no workflow reads issue titles. Never use `gh`.
   - **Open, step 2 (one script call):** `node .harness/scripts/start-slice.mjs --adhoc --title "<title>" --tag core|ui --targets "<a,b>" --verify "<cmd>" --issue <N> --reason "<why>" [--id <N.M>] [--gate-change]`. The script checks the refusals above before it writes anything.
   - **ID:** without `--id`, the script takes the highest numeric major among slice IDs in the working-tree `PROGRESS.md` and in `origin/main:.spec/PROGRESS.md` (skipped when unreadable), then the next free minor under that major. Example: after 17.5 the next ID is 17.6. If 18.1 to 18.3 are planned, the next ID is 18.4. IDs stay numeric, so `parseSliceLine`, `finish-slice.mjs`, `--restamp` and the board all read them. `--id` overrides the rule, for example for a project's own numbering. It must be numeric and unused.
   - **What it records:** one appended line, `- [ ] **Slice <id>: <title>** [IN_PROGRESS] [CORE / DATA|UI / VISUAL] [GATE CHANGE. ]On-the-fly: <reason> Target files: <a, b> | Issue: #<N> | Verify: <cmd>`. It also writes one anchor commit containing only `PROGRESS.md`, with the subject `docs(spec): anchor Slice <id> [IN_PROGRESS]` and the trailers `Spec-Bypass: on-the-fly Issue #<N>` and `Spec-Bypass-Reason: <reason>`, plus one `adhoc_slice_start` batch event. The anchor commit puts the slice in `HEAD:.spec/PROGRESS.md`, so the scope-neutrality check in `finish-slice.mjs` can read its Target files, and it is the 4.A.4 restore anchor.
   - **Work:** normal slice mode. The main thread dispatches `harness:gf-coder` when the work spans more than one edit. The `[CORE / DATA]` and `[UI / VISUAL]` test rules (4.C.5) apply unchanged.
   - **Close:** `node .harness/scripts/finish-slice.mjs "<msg>"` and nothing else. It marks the line `[x]` and stamps the Referee trailers, copying the anchor's Spec-Bypass trailers onto the finish commit so the audit trail shows the slice skipped `/spec`. Never mark `[x]` or type trailers by hand, and never use `--bootstrap`. One PR per slice, with `Closes #<N>`. The auto-merge standing rule applies, because the operator's request is the approval.
   - **Relation to quick fixes:** the no-slice quick fix (one file, at most 25 lines, gate shows red by design) stays as it is. `/quick-fix` (4.A.2) is the one-file on-the-fly slice and passes the gate. In music-visualizer, every change is a slice and the quick-fix path is not used. That rule is unchanged: a one-file change there opens an on-the-fly slice with `--adhoc`, so following the rule now takes one step. `.claude/commands/` does not load in cloud threads (only the plugin's agents and hooks do), so the script call in `CLAUDE.md` and `.claude/harness-rules.md` is the main way in, and `/quick-fix` is a local convenience.

### 4.B Communication
1. `.spec/` model-facing files stay terse.
2. The PM Briefing Format (plain headline, metaphor, "What could go wrong?") is used on Yellow and Red decision cards only. Routine slice receipts stay one line.
3. Terminal steps keep the existing learned rule: one labelled code block per stage, full absolute paths, expected result after each block.

### 4.C Risk colours, CI gate, and relay
1. **Colour frozen at `/spec`.** Slice lines carry one colour and one type, e.g. `[GREEN][CORE / DATA]`. The `architect` sets the colour. `pre-tool-guard.mjs` rejects any `PROGRESS.md` edit that changes the colour tag on the active line.
2. **Red tripwires** in `pr-scope-check.mjs` override any tag: dependency manifests and lockfiles, paths matching `migrations/`, `schema`, `auth`, `.env*`, any file deletion, `AGENTS.md`, `.github/workflows/**`, and any engine path in a spoke.
3. **Free-plan CI gate (no branch protection).**
   - Every PR runs the quick checks plus `pr-scope-check.mjs`, which exits 1 on problems in spokes so the PR shows red (it stays advisory, exit 0, in the hub).
   - A workflow on every push to `main` runs the same checks. On failure it creates the git tag `harness-main-red` pointing at the failing commit and opens an issue `RED: main failed checks at <sha>`. On the next green run it deletes the tag and closes the issue. It never auto-reverts.
   - The tag is the machine signal because any platform can read it with plain git (`git ls-remote --tags origin harness-main-red`): no GitHub API, `gh`, or MCP needed. `session-start.mjs` reports it, and `/implement`, `/quick-fix`, and external agents refuse to start new slices while it exists; fixing `main` is the only allowed work.
   - Antigravity is forbidden by `AGENTS.md` and `.spec/EXTERNAL_AGENT_RULES.md` from pushing to `main` or merging a PR with a red or missing check. This stays policy-enforced; Claude audits every external merge after the fact.
4. **Auto-chaining in `/implement`.** At most 3 Green slices or one milestone, whichever comes first. Per slice: own commit, pushed; CI green on that commit; the test rule below; a local scope and assertion check via the `auditor` (Haiku) subagent and `pr-scope-check.mjs` (never silently upshift to Sonnet/Opus). Any failure turns the chain Yellow and stops it. At the ceiling, Antigravity or Gemini reviews the milestone PR.
5. **Test rule (replaces the fail-before/pass-after check).**
   - `[UI / VISUAL]`: typecheck, lint, and `pr-scope-check.mjs` must pass; no unit test required.
   - `[CORE / DATA]`: `pr-scope-check.mjs` verifies that (a) at least one test file (`*.test.*`, `*.spec.*`, `test_*.py`, `*_test.py`, `*_test.go`) changed, (b) the diff adds or modifies assertion lines (`expect(`, `assert`, `should`, `toBe`, `toEqual`, `raises`, `t.Error`, `t.Fatal`), (c) no existing assertion line was removed without a replacement (otherwise Yellow), and (d) the test runner exits 0. This proves tests exist and run, not that they test the right thing; the code-review pass judges assertion quality and flags always-true assertions.
6. **Relay.** Structured cross-agent relay: Antigravity/Gemini posts verdicts as PR review comments and writes `.spec/AUDIT_VERDICT.json`. Claude's `/ingest-feedback` or `/pickup` can ingest directly from `.spec/AUDIT_VERDICT.json` or PR review comments. `SESSION_HANDOFF.md` gains `Branch Owner: claude | antigravity` and an optional `- **Audit Status:** [CLEAN | NEEDS_CHANGES | AUDIT_PENDING | none]`; only the owner pushes to that branch, and the other side opens `antigravity/<slice>` or comments instead. Baseline: `session-start.mjs`, `/implement`, `/pickup`, and `/ingest-feedback` surface the latest handoff and PR review state when a session starts or resumes. A Claude session subscribed to the PR may also wake on the comment, but nothing depends on that. `AUDIT_VERDICT.md` is not created (structured `.spec/AUDIT_VERDICT.json` is used instead); the clipboard `HANDOFF_PACKET.md` flow stays as a fallback.
7. **Yellow:** at most one self-remediation attempt, then restore to the 4.A.4 anchor and post a decision card.

### 4.D Learning loop
1. Spoke-owned `.claude/project-rules.md` has two sections: `## Active Project Rules` (max 15) and `## Pending Rule Candidates — not in force` (max 10, oldest dropped). Candidates are appended automatically when a Yellow or Red card is resolved or a circuit breaker post-mortem is written. Agents must not follow a pending candidate.
2. `/learn` promotes a candidate to `## Active Project Rules`, or to the hub's `.claude/harness-rules.md` only when the operator says it applies to every project. Hub learned rules are capped at 15; past that `/learn` must merge or retire one.
3. No `.spec/RULE_CANDIDATES.md` and no `## Lessons` section in this file.

### 4.E Sync ownership classes (`hub-sync.mjs`)
| Class | Files | On pull |
|---|---|---|
| Hub-owned | `.harness/**`, `.claude/agents/**`, `.claude/commands/**`, `.claude/harness-rules.md`, `.harness-version`, `.spec/EXTERNAL_AGENT_RULES.md` | Overwrite unless the spoke copy's sha256 differs from `.harness/managed.json` (then stop and report the file). A path in the old manifest but not in the hub is deleted if unmodified or already missing |
| Merged | `.claude/settings.json`, `.gitignore`, `AGENTS.md` | Settings: `hooks` from the hub; `permissions.allow` and `deny` unioned with spoke-owned `.claude/settings.spoke.json`; a spoke `allow` entry that matches a hub `deny` is dropped; other spoke keys kept. `.gitignore` and `AGENTS.md`: only the block between `>>> harness >>>` and `<<< harness <<<` markers is replaced; the hub's `AGENTS.md` block holds the external-agent rules pointer and the three pre-push rules |
| Spoke-owned | `.claude/project-rules.md`, `.claude/settings.spoke.json`, `CLAUDE.md`, `.spec/**` except templates | Never touched |
| Template | `.spec/AI_STUDIO_RULES.md`, `.spec/harness.json`, `.spec/` skeletons, CI workflow files | Copied only if missing |

- **First sync on a v2.2 spoke (no manifest).** Lines in the spoke's `harness-rules.md` that are not in the hub's copy move to `.claude/project-rules.md` under `## Active Project Rules`. Any other hub-owned file that differs from the hub is copied to `.harness-backup/<ISO date>/` before being overwritten, and the receipt lists it. Then `managed.json` is written. Slice tags in `PROGRESS.md` get a colour added (`[YELLOW]` for `[CORE / DATA]`, `[GREEN]` for `[UI / VISUAL]`) and the operator is told to review them.
- `hub-sync.mjs init --target <dir>` bootstraps a spoke from the hub checkout: `CLAUDE.md` skeleton, `.spec/` templates, `.spec/harness.json` with `manager`, the gitignore and `AGENTS.md` blocks, CI workflows, then a normal pull. The `--target` flag is required in Cloud sessions with two repos attached, because `CLAUDE_PROJECT_DIR` is empty in Claude's Bash shell.
- `/learn` push is unchanged: fresh `claude/learn-*` branch off `origin/main` in the sibling hub checkout, then a PR.
- `bundle-handoff.mjs` drops lockfiles from the diff and adds a one-line "lockfile changed" note.
- `runner-matcher.mjs` adds `go test`, `cargo (test|build)`, `python -m (pytest|unittest)`, `make (test|check)`; `.spec/harness.json` may list extra spoke check commands under `"checks"`.

## 5. Harness v3.2 "Autonomous Referee & Turn-Collapsing Engine" Contract
Source: Operator RFC, Antigravity adversarial review, and Claude architectural review (ADR-010).

### 5.A Cognitive Separation: Elephant vs. Goldfish
1. **The Elephant (Planning, Architecture, Spec Finalization):**
   - Active during discovery, architecture design, major refactoring, and locking `.spec/` documentation (`SYSTEM_SPEC.md`, `DECISIONS.md`, `OVERVIEW.md`, `PROGRESS.md`).
   - Uses `architect` (Sonnet) by default, and `architect-opus` (Opus) when deep architectural synthesis is needed.
   - Entry flow: `/triage` acts as a factual Scout writing `.spec/SCOUT.md` (`Files-Touched`, `Contract-Change`, `Cross-Module`). `evaluate-upshift.mjs` maps these fields via a deterministic table to Scout-Level (1: Goldfish `/quick-fix`, 2: Sonnet `architect`, 3: Opus `architect-opus`). Opus is dispatched only when `SCOUT.md` is Level 3 or explicit `/spec opus` was passed.
   - Goal: Leave behind self-contained contracts and atomic (`<5` target files), risk-tagged slices in `.spec/PROGRESS.md` so implementation requires zero long-horizon memory.
2. **The Goldfish (Stateless Implementation & Review):**
   - Handles all day-to-day slice implementation, unit testing, PR scope reviews, and debugging.
   - Runs on Haiku baseline (`engineer`, `auditor`, `clerk`), Hydrogen (inherit) / Gemini Pro in Antigravity/AI Studio, or Sonnet (`engineer-sonnet`) when escalated.
   - **Hard Rule: Opus is never used for Goldfish work.**
3. **Dispatch Sizing & Mechanical Guard:**
   - Guard 0 in `pre-tool-guard.mjs` mechanically verifies subagent dispatch against `.spec/SCOUT.md`: `architect-opus` is blocked unless `SCOUT.md` specifies Level 3, and `engineer-sonnet` is blocked unless `SCOUT.md` specifies Level 2 or 3.
   - Agents announce dispatch on Line 1: `🐘 Dispatching Elephant subagent (<name>)...` or `🐠 Dispatching Goldfish subagent (<name>)...`.

### 5.B Neutral Referee & Verification Trailers
1. **Neutral Arbiter (`referee.mjs`):**
   - Pure, zero-dependency Node script that evaluates repository health, scope adherence, test rules, and natural lulls. Never modifies application source code.
   - **Scope Neutrality:** Reads target files from `HEAD:.spec/PROGRESS.md` (`git show HEAD:.spec/PROGRESS.md`), not the mutable working copy, preventing workers from retroactively widening scope.
2. **Commit Trailers & Audit Marker Semantics:**
   - `finish-slice.mjs` verifies the slice and commits using Git trailers:
     - `Referee-Verdict: VERIFIED`
     - `Referee-Tree: <tree-sha>` (from `git rev-parse HEAD^{tree}`)
     - `Referee-Engine: <referee-mjs-sha256>`
   - **Audit Marker Threat Model:** The trailers function as deterministic audit markers and tree integrity fingerprints (binding `HEAD^{tree}` and `referee.mjs` SHA-256) within the repository workspace. They guard against post-verification modifications, engine mismatches, and branch skew; they are not cryptographic identity attestations or digital signatures.
3. **Zero-Turn Baton Pickup (`baton-pickup.mjs`):**
   - On `/pickup`, if `HEAD` carries `Referee-Verdict: VERIFIED`, `git status --porcelain` is clean, and `git rev-parse HEAD^{tree}` matches `Referee-Tree`, prior work is trusted via deterministic tree integrity and engine fingerprinting without re-running checks in Claude.
4. **Natural Lull Detection:**
   - Detected deterministically in `referee.mjs` at clean slice commit boundaries without LLM tokens:
     - Cumulative session tool calls `>= 40` or committed slices `>= 3`.
     - Upcoming slice is `[RED]`, or transitions between `[GREEN]` and `[YELLOW]` or `[CORE / DATA]` and `[UI / VISUAL]`.
     - Milestone heading complete in `PROGRESS.md`.
     - Immediately after a 2-strike restore.
   - Halts `/implement` auto-chaining cleanly.
   - Mid-slice backstop in `post-tool-scrub.mjs`: emits a 1-line soft advisory nudge when mutating tool calls (`Edit`/`Write`/`Bash`) on the active slice reach 15.
