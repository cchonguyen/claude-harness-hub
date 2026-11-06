# Harness Specification (as built, 2026-11-06)

**Status:** authoritative description of what runs today. Written for an external reviewer or agent with no prior context.
**Snapshot:** `main` at `c595c43` (PR #117), harness `3.2.0` (`.harness-version`), plugin `0.3.0` (`plugins/harness/.claude-plugin/plugin.json`), 327 unit tests.
**Supersedes for "what runs":** `.spec/SYSTEM_SPEC.md` sections 4 and 5, which are design contracts. Where the two disagree, this file describes the code and SYSTEM_SPEC describes intent. Section 14 lists every known disagreement.
**Companion:** the critical assessment is in `.spec/post-mortems/harness-council-review-2026-11-06.md`.

Status legend used below:

| Tag | Meaning |
|---|---|
| **LIVE** | Seen working in a real Claude project thread, with evidence cited |
| **BUILT** | Code and tests exist; never shown working where the operator works |
| **INERT** | Code runs but cannot take effect in the current host (explained per row) |
| **DESIGN** | Described in docs; no code |

---

## 1. Purpose and north star

The harness is a reusable kit of hooks, subagent definitions, scripts and spec conventions. It lives in this hub repo and is copied into product repos ("spokes"). The operator (Charlie) stated six intents; every component should trace to at least one.

| # | Intent | Operator wording (paraphrased) |
|---|---|---|
| N1 | Human–agent collaboration | The operator directs; agents and subagents do the work. |
| N2 | Sip tokens | Route work to the cheapest adequate model. Load only the context a task needs. |
| N3 | Step back from micromanagement | No terminal commands for the operator, no merge clicks, no re-confirming what a spec or plan already approved. |
| N4 | Self-driving | Drop into Claude or Antigravity, initialize from repo instructions, deliver value without tinkering. |
| N5 | Self-auditing and self-healing | Telemetry and logs that let the system see its own failures and fix them as intended. |
| N6 | Proportionate engineering | No machinery whose cost exceeds its benefit under the real host constraints. |

---

## 2. Runtime topology

### 2.1 Actors

| Actor | Where it runs | What it can do | What it cannot do |
|---|---|---|---|
| Operator | claude.ai web app and GitHub web UI; a Mac he does not drive by terminal | Approve plans and decision cards, merge on GitHub, edit project and environment settings | Run terminal commands (standing rule); recall secrets such as `HARNESS_VERIFY_SECRET` |
| Coordinator | Project chat session on claude.ai | Start threads, relay operator messages, read threads | Edit repos directly; see thread containers |
| Thread session | Ephemeral cloud container, one per thread | Git, Node, tests, GitHub MCP, `gh` for search only, subagents | Read repo `.claude/settings.json`, repo agents or repo commands (see 2.2) |
| Subagent | Spawned inside a thread by the Agent tool | Work under its own model and tool list | Talk to the operator |
| GitHub Actions | GitHub | CI checks, plan acceptance, automerge with `GITHUB_TOKEN`, status snapshot | Reach containers or the Mac |
| Mac session | Operator's Mac via Remote Control or folder access | Local dashboard, local checkout | Bypass the Mac's auto-mode classifier |
| Antigravity / AI Studio | Google tools, operator-driven | Same repo via git; `.agents/hooks.json` adapter | Use claude.ai project tools |

### 2.2 Host constraints the design must respect (verified)

| Constraint | Evidence | Consequence |
|---|---|---|
| Project threads start Claude Code with `--setting-sources user` | PR #46; memory `harness-threads-plugin` | Repo `.claude/settings.json` hooks, `model`, permissions, `.claude/agents/`, `.claude/commands/` never load in threads. Only `CLAUDE.md` loads. |
| Plugins reach threads only from `~/.claude/skills/<name>` (loaded as `<name>@skills-dir`) or claude.ai-synced plugins | PR #46, thread `cmsg_…CP1anWqH4AtqM8biYKapEN` | The harness ships as a plugin folder installed by the environment setup script. |
| Containers resume from cache (`session_mode: resume-cached`) | `/tmp/env-manager.log` in this session (17:15:30 UTC) and on 5 Nov | The setup script may not rerun; an old plugin copy can persist for days. |
| Plugin hooks load at session start only | Canary trace `/mnt/project-files/harness-hub/canary/PHASE1_CANARY_TRACE_2026-11-05.md` | A plugin refresh takes effect in the next session, never the current one. |
| Claude's GitHub tools act as the operator's account | `merged_by=cchonguyen` on PRs #89, #100, #101, #111, #117 (GitHub API, read 6 Nov) | GitHub cannot tell operator merges from Claude merges unless a bot token merges. |
| Auto-mode classifier can deny tool calls with no prompt to anyone | Threads `cmsg_…FasjnLvaEt11vSHQMUXQXN` (kill PID), `cmsg_…D9oAkbs9h3KP6pwhqY11JH` (02:26, 04:13 UTC) | Approved work can stop on a denial that only the operator's explicit restatement clears. |
| Container filesystem is ephemeral and gitignored state never leaves it | ADR-011; `.gitignore` lists `.spec/.events/`, `.spec/.session-telemetry.json` | All runtime telemetry dies with the container unless shipped elsewhere. |
| Threads cannot start other threads | Coordinator chat, 28 Oct (`/blank-thread`) | Only the coordinator can fan out work. |

---

## 3. Delivery path (how code reaches a thread)

```
Environment setup script (claude.ai project settings; copy at plugins/harness/setup-script.sh)
  └─ curl codeload tarball of hub main → extract plugins/harness → ~/.claude/skills/harness
       (on failure: keeps the old copy, prints to stderr, exit 0)
Claude Code session start
  └─ loads ~/.claude/skills/harness as plugin "harness@skills-dir"
       ├─ agents/ → harness:el-architect, harness:gf-coder, harness:gf-verifier, harness:gf-navigator, harness:gf-clerk
       └─ hooks/hooks.json
            ├─ SessionStart: refresh.mjs → run.mjs session-start.mjs → standing-rules.mjs
            ├─ PreToolUse (Agent|Task|Edit|Write|NotebookEdit|Read|View|Grep|Glob): run.mjs pre-tool-guard.mjs
            ├─ PreToolUse (Bash): run.mjs bash-guard.mjs
            ├─ PostToolUse (Bash): run.mjs post-tool-scrub.mjs
            ├─ PostToolUse (*): run.mjs post-tool-telemetry.mjs
            ├─ PostToolUseFailure (Bash): run.mjs post-tool-failure.mjs
            ├─ Stop: run.mjs stop-guard.mjs
            └─ SubagentStop (el-architect): run.mjs el-exit-gate.mjs
run.mjs: walks up from payload.cwd / CLAUDE_PROJECT_DIR / cwd to find .harness/hooks/adapter.mjs,
         spawns it with the hook payload, passes its exit code through. No .harness/ → exit 0, silent.
adapter.mjs: normalizes Claude Code and Antigravity tool names and inputs, runs the named
         .harness/hooks/<script>, appends kind:"hook_error" to the event log when a script crashes.
```

| Element | File | Status |
|---|---|---|
| Setup script | `plugins/harness/setup-script.sh` (the live copy is pasted into the claude.ai environment) | **LIVE**, but fails open (exit 0) and is skipped on cached resumes |
| Self-refresh | `plugins/harness/hooks/refresh.mjs` (slice 10.6, PR #86): copies repo `plugins/harness` over an older installed copy | **BUILT**; only effective next session; only in the hub, because spokes do not carry `plugins/harness` |
| Standing rules injection | `plugins/harness/hooks/standing-rules.mjs` (PR #90): injects the auto-merge rule into every thread, with or without `.harness/` | **LIVE** (seen at the top of this session) |
| Repo-local hook registration | `.claude/settings.json` registers the same hooks via `adapter.mjs` | **INERT** in threads; active in local CLI and Antigravity, where telemetry is then registered twice (post-mortem `dispatch-telemetry-2026-11-06.md`) |
| Antigravity hook map | `.agents/hooks.json` | **BUILT**; unverified this week |

The hooks are two layers on purpose: the plugin is a thin router, and each repo runs its own pinned `.harness/hooks/`. A spoke therefore runs the engine version it last synced, whatever plugin version is installed.

---

## 4. Hook catalog

| Hook script | Event | Does | Enforcement today |
|---|---|---|---|
| `session-start.mjs` | SessionStart | Creates `.spec/.session-telemetry.json` if missing; Vibe baseline snapshot; runs Doctor probes and writes `/tmp/harness-session-state.json`; checks `harness-main-red` tag; injects branch owner and "Where we left off" from `SESSION_HANDOFF.md`; plugin-version mismatch banner; appends `heartbeat` event | Advisory. The first banner line is fixed text: "Model tier: Haiku baseline" is printed whatever model runs (`session-start.mjs` line 42) |
| `pre-tool-guard.mjs` | PreToolUse (non-Bash) | Role detection from `agent_type`; fast-path budget; goldfish search breaker; doctor gate; main-thread allow-list; plan lock; work lock; colour lock; engine lock; target-file scope lock; upshift lock | Mixed, see section 5 |
| `bash-guard.mjs` | PreToolUse (Bash) | Hard blocks (`lib/hard-blocks.mjs`) first, then doctor gate and main-thread allow-list as warnings | Hard blocks exit 2; rest warn |
| `post-tool-scrub.mjs` | PostToolUse (Bash) | Scrubs noisy test output, advances Vibe green checkpoint on passing test/build, mutating-call nudge at 15 | Advisory |
| `post-tool-telemetry.mjs` | PostToolUse (*) | Appends a call record (tool, agent type, dispatched type, role, file, slice) to `.spec/.session-telemetry.json` under a lock (`lib/telemetry-store.mjs`, PR #92) | Advisory. Undercounts: this session's file showed `totalToolCalls: 10` against 22 `calls` entries and more than 25 real calls |
| `post-tool-failure.mjs` | PostToolUseFailure (Bash) | Two-strike circuit breaker with error fingerprinting; ignores environment errors (exit 127, missing module) | Advisory; never seen firing live |
| `stop-guard.mjs` | Stop | Blocks a turn exit while `PROGRESS.md` has `- [ ]` or `[IN_PROGRESS]` lines, unless `CLAUDE_WAKE_SCHEDULED=1` or `CLAUDE_PR_SUBSCRIBED=1` | **INERT**: nothing sets either variable, and the current `PROGRESS.md` has 0 matching lines because unfinished slices are written without a checkbox |
| `el-exit-gate.mjs` | SubagentStop (el-architect) | Validates that the architect left atomic slices with Target files and Verify commands | **BUILT**; respects `stop_hook_active` since PR #43 |

---

## 5. Enforcement model

Since 6 Nov (PRs #98–#117) the harness has three enforcement classes.

### 5.1 Hard blocks (exit 2, always)
Source of truth `lib/hard-blocks.mjs` (PR #100, #114):
- `git push` with `-f`, `--force*`, `+refspec`
- `git branch -D`
- deploy commands (`npm run deploy`, `firebase|netlify|fly|gcloud … deploy`, `wrangler deploy|publish`, `vercel --prod`, `gh workflow run *deploy*`)
- `gh repo edit --visibility`
- engine lock in spokes: Bash writes to `.harness/**`, `.claude/**`, `.harness-version`, the AGENTS.md harness block

Not covered (open since 5 Nov): `git push origin :branch` (remote delete), `git branch -f`, `git reset --merge`, `git checkout <file>`.

### 5.2 Still-refusing locks outside the hard-block list
In `pre-tool-guard.mjs`: more than one `[IN_PROGRESS]` slice (work lock), colour-tag change on the active slice, engine lock on Edit/Write in spokes, target-file scope lock while a slice is active, upshift locks for `architect-opus` and `engineer-sonnet` (**INERT** in threads: those agents live only in `.claude/agents/`). In `finish-slice.mjs`: refuses when telemetry shows the main thread wrote source files for the slice (blind to Bash writes). In spoke CI only: `ci-gate.mjs pr` fails a PR whose head commit lacks `Referee-Verdict`/`Referee-Tree` trailers or whose tree changed after stamping. The hub's own workflows do not run `ci-gate.mjs`.

### 5.3 Soft gates (warn on stderr, append an event, allow)
| Gate | Event kind | PR |
|---|---|---|
| Doctor not current for HEAD | `doctor_stale` | #101 |
| Fast-path budget (3 reads, 1 search, 1 edit ≤25 lines) | `fast_path_warn` | #102 |
| Main-thread Bash/Edit allow-list | `main_thread_warn` | #103 |
| Goldfish search breaker (2 searches) | `goldfish_breaker_warn` | #105 |
| Plan lock (edit with no slice) | `plan_lock_warn` | #111 |
| Missing slice line in a PR (spoke CI) | `::warning::` annotation | #117 |
| Telemetry dispatch gate in `finish-slice` | disabled outright, prints a notice | #95 |

The warning text is written to the hook's stderr. Claude Code does not show stderr from an exit-0 hook to the model, so the agent being warned does not see it. The `main_thread_warn` detail still reads "Main thread Bash refused" although the call is allowed.

---

## 6. Agents and model routing

| Agent | Model | Tools | Defined in | Reachable in threads |
|---|---|---|---|---|
| `harness:el-architect` | opus | Read, Glob, Grep, Edit, Write, Bash | `plugins/harness/agents/` | Yes |
| `harness:gf-coder` | haiku | Read, Edit, Write, Bash, Glob, Grep | same | Yes |
| `harness:gf-verifier` | haiku | Read, Bash, Grep, Glob | same | Yes |
| `harness:gf-navigator` | haiku | Read, Edit, Write, Glob, Grep, Bash | same | Yes |
| `harness:gf-clerk` | haiku | Read, Edit, Write, Bash | same | Yes |
| `architect`, `architect-opus`, `engineer`, `engineer-sonnet`, `auditor`, `clerk`, `discovery` | sonnet/opus/haiku | various | `.claude/agents/` only | No (legacy v3.1 names) |

The same five `el-`/`gf-` definitions exist in four places: `plugins/harness/agents/`, `.claude/agents/`, `.harness/agents/` (plus `runtime-payloads.json` for Antigravity) and `.agents/`. Only the plugin copy matters in threads, and the copies have drifted (`plugins/harness/agents/gf-coder.md` is 1783 bytes; the others are 1300).

The **main thread's model is not controlled by the harness**. `.claude/settings.json` sets `"model": "haiku"`, which does not load in threads. The thread runs whatever model the coordinator or operator picked (this audit runs on Opus by the operator's request; all 5 Nov threads ran Haiku). Routing to cheaper models therefore happens only when the main thread chooses to dispatch a subagent. `CLAUDE.md` instructs that dispatch; the fast-path budget used to force it and now only warns.

Naming: `CLAUDE.md` calls the main thread "the main thread"; `AGENTS.md` calls it "THE FALCON (Tier 2)"; design docs use Elephant (planning), Falcon (coordinator), Goldfish (stateless workers).

---

## 7. State and persistence

| Path | Written by | Read by | Lifetime | In git |
|---|---|---|---|---|
| `.spec/PROGRESS.md` | Threads, `start-slice.mjs`, `finish-slice.mjs`, `accept-plan` workflow | Guards, dashboard, status page | Permanent | Yes |
| `.spec/SESSION_HANDOFF.md` | Any platform by hand, `gf-clerk` | `session-start.mjs` (injects 2 lines) | Permanent | Yes |
| `.spec/plans/*.md` | Threads | `accept-plan.yml` | Permanent | Yes |
| Commit trailers `Referee-*`, `Telemetry-*`, `Spec-Bypass-*` | `finish-slice.mjs`, `start-slice.mjs` | `ci-gate.mjs`, `baton-pickup.mjs` | Permanent | Yes |
| `.spec/.events/<session>.jsonl` | `lib/event-log.mjs` (all hooks) | `triage-events.mjs` | Container | No |
| `.spec/.session-telemetry.json` | `post-tool-telemetry`, `pre-tool-guard`, `finish-slice` | `finish-slice`, doctor | Container | No |
| `/tmp/harness-session-state.json` | `session-start.mjs`, `doctor.mjs` | `pre-tool-guard`, `bash-guard` | Container | No |
| `.spec/.vibe-checkpoint.json`, `refs/harness/*` | `vibe.mjs` | `--restore` | Container | No |
| `.spec/STATUS_BATCH.jsonl` | `status-batch.mjs` | `/brief` | Container | No |
| `status.json` on GitHub Pages | `status-snapshot.yml` every 5 min and after automerge | Hosted status page | Permanent | Pages branch |
| `/mnt/project-files/harness-hub/**` | Threads | Threads, operator | Project | No (shared folder) |
| Project memory `team/silo/*.md` | Threads, coordinator | Every session at start | Project | No |

Only rows marked "Permanent" survive a container. Everything the self-audit needs (events, telemetry, doctor state) is in the "Container" rows.

---

## 8. Telemetry and logging

- **Event log** (`lib/event-log.mjs`, slice 11.1): one JSON line per event, `{"v":1,"ts","session","kind","source","slice","detail"}`, under 4096 bytes, written with `O_APPEND`, never throws. Kinds in use: `heartbeat`, `plugin_version_mismatch`, `hook_error`, `doctor_stale`, `fast_path_warn`, `main_thread_warn`, `goldfish_breaker_warn`, `plan_lock_warn`, `spec_bypass`.
- **Triage** (`node .harness/scripts/triage-events.mjs [--session id] [--json]`, slice 11.8): groups failure kinds per session, lists sessions with no heartbeat as silent. Nothing runs it automatically. `/triage-events` exists only as a repo command, which threads cannot invoke.
- **Tool telemetry** (`.spec/.session-telemetry.json`): call records with role and agent type; used by `finish-slice` to stamp `Telemetry-Dispatches` and `Telemetry-Main-Source-Writes` trailers. The dispatch gate is off (PR #95) but the trailers are still stamped.
- **Doctor** (`.harness/scripts/doctor.mjs`): six probes. What each actually tests:

| Probe | Severity | What it really checks |
|---|---|---|
| `fast-path-budget` | fail | Calls the budget function in-process with fake input; does not test that the hook is loaded |
| `gf-coder-registered` | fail | `plugins/harness/agents/gf-coder.md` exists in the repo; skipped in spokes |
| `handoff-fresh` | warn | `SESSION_HANDOFF.md` exists (not its age) |
| `telemetry-writable` | fail | `.spec/` is writable |
| `spoke-engine-hash` | skip | "not implemented yet" |
| `plugin-current` | warn | Installed plugin version equals repo `plugins/harness` version |

- **Not recorded anywhere:** token usage, model per call, wall-clock idle time, operator interventions, approvals given, merges by actor. The platform's `get_session` / `list_events` APIs hold token data; the harness does not read them.

---

## 9. Work model

1. **Slice:** one line in `.spec/PROGRESS.md`: `- [ ] **Slice N.M: title** [CORE / DATA|UI / VISUAL] Target files: … | Coords: […] | Verify: <command>`. `[IN_PROGRESS]` marks the active one. `[CORE / DATA]` needs tests; `[UI / VISUAL]` needs typecheck only.
2. **Start:** `node .harness/scripts/start-slice.mjs <id>` marks it active and commits an anchor. `--from-scope <doc> --slice <id> --targets "<paths>" --reason "<why>"` anchors from an existing scope doc with `Spec-Bypass` trailers (PR #112).
3. **Implement:** main thread dispatches `harness:gf-coder` with the slice line and Verify command.
4. **Finish:** `node .harness/scripts/finish-slice.mjs "<msg>"` runs scope checks against `HEAD:.spec/PROGRESS.md`, marks `[x]`, stamps `Referee-Verdict: VERIFIED`, `Referee-Tree`, `Referee-Engine`, `Telemetry-*` trailers, commits. Auto-advance to the next slice was removed (PR #110). Optional `bin/verify-slice.sh` runs only if the operator's verify secret is present; CI is recorded as the verifier (PR #97).
5. **Approve:** a plan file in `.spec/plans/` lists slices; merging it is the approval (`accept-plan.yml`, slice 8.3).
6. **Merge:** standing rule says merge green approved PRs automatically. Two mechanisms exist: a thread calls GitHub MCP `merge_pull_request` (records the operator as merger), or a thread adds label `harness:automerge` and `automerge.yml` merges with `GITHUB_TOKEN` as `github-actions[bot]` and dispatches the status snapshot. No PR from #89 to #117 carries the label.
7. **CI on the hub:** `harness-verify.yml` (job `verify`: full tests, typecheck, lint) and `quick-checks.yml` (job `checks`: typecheck, lint, one test file). `accept-plan.yml`, `automerge.yml`, `status-snapshot.yml`. No branch protection; no required checks are enforced by GitHub.

---

## 10. Hub and spokes

- `.harness/hub.json` in each spoke names the hub. `hub-sync.mjs pull` copies from a sibling checkout at `../claude-harness-hub` (both repos attached to the session); it never adds a git remote.
- Ownership classes (SYSTEM_SPEC 4.E): hub-owned files overwrite unless locally modified per `.harness/managed.json`; merged files (`.claude/settings.json`, `.gitignore`, `AGENTS.md` block) are spliced; spoke-owned files (`CLAUDE.md`, `.spec/**`, `.claude/project-rules.md`) are never touched; templates copy only when missing.
- `plugins/harness` is not synced to spokes. Spokes rely on the environment setup script of their own claude.ai project, so each spoke project needs the same script pasted into its environment.
- Known spokes: Concert-Tracker, job-application-tracker, music-visualizer, music-story, charliechonguyen.com (all private).

---

## 11. External agents

`.spec/EXTERNAL_AGENT_RULES.md` is the contract for Google Antigravity and AI Studio (ADR-007): one bounded task, a branch per task, the shared `SESSION_HANDOFF.md` five-field format, no push to `main`, no merge on red. Antigravity reads `AGENTS.md` and `.agents/`; subagent payloads compile to `.harness/agents/runtime-payloads.json`. Last confirmed Antigravity activity in the hub: slices 4.1–6.4 (2–3 Nov).

---

## 12. Operator surfaces

| Surface | Source of truth | Status |
|---|---|---|
| Hosted status page `cchonguyen.github.io/claude-harness-hub` | `status.json` built by `status-snapshot.yml` from `PROGRESS.md` and GitHub | **LIVE**, refreshed every 5 min |
| Local Command Center `dashboard/command-center.mjs` on port 3456 | Same derived state | **LIVE** on the Mac after a 22-hour restart (5 Nov 10:28 → 6 Nov 08:22) |
| React dashboard (`server.ts`, `src/`) | Files on disk | **BUILT**, `npm run dev` only |
| Thread messages and checklists | Agents' own reports | **LIVE**; the operator's real interface |

---

## 13. Commands and where they work

19 files in `.claude/commands/`. Threads cannot load them. Six exist as account skills (`anthropic-skills:implement`, `ingest-feedback`, `prep-audit`, `start-project`, `sync-harness`, `triage`). `learn` is shadowed by an unrelated built-in `learn` skill. The other twelve, including `/spec`, `/pickup`, `/quick-fix`, `/wrap`, `/review-pr`, `/brief`, `/triage-events`, do not resolve in threads even though `CLAUDE.md`, the handoff banner ("Run /clear then /pickup") and the plan-lock warning tell agents to run them.

---

## 14. Drift register (docs vs code, 6 Nov)

| Document says | Code or host does | Where |
|---|---|---|
| "The plugin's hooks enforce a fast-path budget… A `FAST-PATH BUDGET EXCEEDED` warning means delegate" | Budget warns on stderr only; the model never sees it | `CLAUDE.md`, PR #102 |
| "The `Harness slice gate` check must pass" | No hub workflow runs `ci-gate.mjs`; it is a spoke template | `CLAUDE.md`, `.github/workflows/` |
| Banner "Model tier: Haiku baseline" | Model is whatever the session runs | `session-start.mjs` line 42 |
| Handoff: "Last Active Platform: Google Antigravity… Branch Owner: antigravity… Run /clear then /pickup" | Last 60+ commits are Claude threads; `/pickup` does not exist in threads | `.spec/SESSION_HANDOFF.md` (corrected in this PR) |
| SYSTEM_SPEC 4: Manager Mode "locked, not yet built" | Built in slices 3.0–3.5; plan lock now soft | `.spec/SYSTEM_SPEC.md` |
| SYSTEM_SPEC 5.A.3 Guard 0 gates `architect-opus`/`engineer-sonnet` via `SCOUT.md` | Those agents are unreachable in threads; no `SCOUT.md` exists | `pre-tool-guard.mjs` lines 409, 424 |
| OVERVIEW "In Progress: None", "Up Next: live check in a spoke" | Phase 3 Concert-Tracker trial never started | `.spec/OVERVIEW.md` |
| PROGRESS soft cap 60 lines, lint "line budgets valid" | 55 lines but 27,961 bytes; caps count lines, not tokens | `thresholds.json`, `navigator.mjs` |
| Merged slices are `[x]` | 11 merged slices have no checkbox at all (10.4–10.9, 11.1, 11.13–11.15); ids 10.7 and 11.9 are each used twice | `.spec/PROGRESS.md` |
| Stop hook prevents stalls | Escape variables never set; regex matches 0 lines | `stop-guard.mjs` |
| Setup script "exits non-zero on failure" (snag plan Stage 1) | Still `exit 0` | `plugins/harness/setup-script.sh` |
| `bin/restart-dashboard.sh` allow-listed (Phase 2, slice 5) | File does not exist | `bin/` |
| Slice 11.11 removes Referee trailer checks (operator "Yes." at 02:25:27) | Never landed; classifier denied the edit | thread `cmsg_…D9oAkbs9h3KP6pwhqY11JH` |

---

## 15. Verification

```
node --test plugins/harness/test/run.test.mjs .harness/hooks/lib/*.test.mjs .harness/scripts/*.test.mjs .harness/scripts/lib/*.test.mjs
npm run typecheck --silent && npm run lint --silent
node .harness/scripts/doctor.mjs
node .harness/scripts/triage-events.mjs
grep -o '"version": *"[^"]*"' ~/.claude/skills/harness/.claude-plugin/plugin.json   # installed plugin
grep session_mode /tmp/env-manager.log | tail -1                                     # fresh or cached container
```
`typecheck` is a Node syntax check over `.mjs` files (`syntax-check.mjs`), not TypeScript. `lint` is the Atlas link and line-budget check (`navigator.mjs --check`).
