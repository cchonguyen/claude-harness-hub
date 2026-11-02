# System Specification & Contracts

## 1. Core Scope & MVP Boundaries
- Provide deterministic hooks, model-routed subagents, and zero-cost Gemini audit handoffs.
- **Gemini Bridge reference inlining:** in `spec` mode, `bundle-handoff.mjs` scans `.spec/SYSTEM_SPEC.md` (and `.spec/OVERVIEW.md`) for local Markdown links, resolves the ones that exist inside the repository, and inlines their contents under an `# APPENDED REFERENCES` section of `.spec/HANDOFF_PACKET.md`. Links outside the repo root, URLs, and missing files are skipped.

## 2. Strictly Out of Scope ("Do NOT Build" List)
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

## 4. Harness v3.0 "Manager Mode" Contract (locked 2026-11-01, not yet built)
Source: Claude review of the v3.0 RFC, operator decisions, and the Antigravity adversarial review (ADR-008). Build order is in `.spec/PROGRESS.md` (Slices 3.0 to 3.5). Until those slices ship, sections 1 to 3 above describe what actually runs.

### 4.A Work modes and engine lock
1. **Mode switch.** Spoke-owned `.spec/harness.json` holds `{ "workMode": "manager" | "vibe" }`. `hub-sync.mjs init` writes `manager`. A spoke with no file keeps `vibe`, so v2.2 spokes do not change behavior on upgrade. In `manager`, 0 `[IN_PROGRESS]` slices blocks edits outside `.spec/` with `PLAN LOCK: No task is marked [IN_PROGRESS] in .spec/PROGRESS.md. Run /triage or /spec first.` `modeOf()` returns `'locked'` for that case.
2. **`/quick-fix <description>`** is the Manager Mode escape hatch. For one file only, it appends `- [ ] **Slice QF-N** [GREEN][UI / VISUAL]: <desc> — Target files: <file>`, marks it `[IN_PROGRESS]`, edits, runs the quick checks, and marks it `[x]` in one turn. It refuses when the file matches a Red tripwire path (4.C.2) or an engine path.
3. **Engine lock in spokes, every mode.** Blocked: `.harness/**`, `.harness-version`, `.claude/settings.json`, `.claude/agents/**`, `.claude/commands/**`, `.claude/harness-rules.md`, `.spec/EXTERNAL_AGENT_RULES.md`, and the harness block inside `AGENTS.md`. Spoke rules live in spoke-owned `.claude/project-rules.md`, imported from `CLAUDE.md` with `@.claude/project-rules.md`. Hub detection uses the `origin` URL only; the folder basename and `hub.json` checks are dropped because an agent can change them.
4. **Slice anchor.** `pre-tool-guard.mjs` keeps the fast local `refs/harness/slice-checkpoint` capture (PreToolUse runs before the edit lands, so it never commits or pushes). The durable anchor is a git commit: `/implement` requires a clean working tree before the first slice of a chain (committing pending `.spec/` edits first), and each finished slice is its own commit, so commit N-1 is the anchor for slice N. `--restore` falls back to that commit when the local ref is missing. Antigravity restores with `git restore --source=<anchor> -- <target files>`.
5. **Bash write tripwire.** A new PreToolUse hook on `Bash` blocks commands that write to engine paths or `AGENTS.md`: redirects `>` and `>>`, `tee`, `cp`, `mv`, `rm`, `sed -i`, `perl -i`, `python -c`, `node -e`, `git checkout --`, `git restore`. It is a speed bump only; CI (4.C.3) is the real wall.

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
   - Runs on Haiku baseline (`engineer`, `auditor`, `clerk`), Gemini Flash/Pro in Antigravity/AI Studio, or Sonnet (`engineer-sonnet`) when escalated.
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
