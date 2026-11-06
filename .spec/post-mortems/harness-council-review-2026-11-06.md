# Harness post-mortem for external council review (2026-11-06)

**Period:** 26 Oct – 6 Nov 2026, with depth on 4–6 Nov.
**Builds on:** the 5 Nov retrospective (`/mnt/project-files/harness-hub/RETROSPECTIVE.md`, artifact `3uenBLbddGuzrqPfctD5Du`), the transcript investigation (artifact `TKTajgCVH2t1HnRavCCJEy`) and `.spec/post-mortems/dispatch-telemetry-2026-11-06.md`. Their numbers are reused, not re-derived, unless marked **[re-measured]**.
**Technical reference:** `.spec/HARNESS_SPEC.md` (as-built spec). Read it first if any term below is unfamiliar.
**Author:** a Claude thread asked by the operator for a critical, evidence-backed review. Claude built most of this system; read its self-assessment with that in mind.

**Evidence keys.** `PR #n` and file paths are public in `github.com/cchonguyen/claude-harness-hub`. `thread T-x` and `msg …` are private project-chat ids, listed in Appendix A with the shared prefix `cmsg_017AUYngxmk255BZpRgjhbx4`. `[container]` means observed in this audit's own cloud session on 6 Nov 17:15–18:00 UTC.

---

## 1. Bottom line

1. **The harness has been its own only product.** From PR #73 (5 Nov 17:28 UTC) to PR #117 (6 Nov 04:42 UTC), 45 PRs merged in about 11 hours, every one about the harness. No product feature went through it this week. The Phase 3 Concert-Tracker trial, approved on 5 Nov 17:21, never started. [re-measured: GitHub PR list]
2. **Within 33 hours the design swung from "hard-halt everything" to "warn on everything".** On 5 Nov 17:21 the operator approved a Doctor that refuses all edits on failure and a finish gate that refuses commits without a subagent dispatch (msg `P4HeWov5…`). On 6 Nov 02:24 he wrote "Cut the gates and stop asking" (msg `XKgtEAkG…`). Gates became warnings in PRs #101–#111, merged between 02:19 and 02:48. Neither extreme was tested against a real product.
3. **The gates failed closed on missing instrumentation, and the instrumentation was missing because of delivery.** Every hard stop on 5–6 Nov traced back to one host fact: cloud containers resume from cache, so the setup script did not rerun and threads kept a stale plugin without the telemetry hook. The finish gate then refused honest work for about 6 hours (5 Nov 18:51 → 6 Nov ~01:00).
4. **Soft gates now warn into a void.** Warnings go to hook stderr, which the model does not see, and to a gitignored per-container log that nothing reads. In this audit's own session, the main-thread guard logged 3 `main_thread_warn` events against my shell reads; I saw none of them. [container]
5. **The operator is still the integration test, the approver of record, the merge identity and the escalation path for classifier denials.** Charlie's messages this week include "I'm tired of these snags" (T-P2, 5 Nov 18:54:22), "Why must everything be so damn annoying" (msg `57kTBCcW…`, T-C2), and "It's dumb you always ask when I told you not to" (msg `1Hno3aZ1…`). Each one followed an agent asking him to confirm something he had already decided.
6. **What worked is small and real:** plugin delivery of subagents and hooks (PR #46), plan-merge approval (PR #59), status derived from GitHub (ADR-011), the event-log primitive (PR #98), the hard-block list (PR #100), and fast slice throughput once nothing blocked it.

---

## 2. Scorecard against the six intents

| Intent | Grade | One-line reason | Key evidence |
|---|---|---|---|
| N1 Collaboration | C | Delegation to `gf-coder` works when the plugin is current; the coordinator–thread–operator loop generates most of the friction | 9 + 5 dispatches on 5 Nov (retrospective §2); threads T-SG, T-P2 |
| N2 Sip tokens | D | Never measured. No token data in any harness log. Main-thread model is not controlled by the harness. Main thread still reads and writes through Bash | `HARNESS_SPEC.md` §6, §8; [container] telemetry |
| N3 Step back | D | 22-hour dashboard restart; verify secret the operator never had; repeated re-confirmation of decisions already made | T-RC; T-C2; T-SG 02:08–02:24 |
| N4 Self-driving | D | Delivery depends on a setup script that fails open and is skipped on cached resumes; 12 of 19 commands unreachable in threads; stale handoff injected every session | `setup-script.sh`; `HARNESS_SPEC.md` §13; this session's banner |
| N5 Self-audit / self-heal | D+ | Event log and triage exist, but data is container-local, warnings are invisible, Doctor probes are mostly tautological, nothing runs triage on a schedule | `doctor.mjs`; `.gitignore`; `triage-events.mjs` |
| N6 Proportionality | D | Four copies of each agent, Atlas sector numbering, Referee engine hashes, three dashboards, 19 commands, line budgets measured in lines | `HARNESS_SPEC.md` §6, §12, §14 |

---

## 3. Timeline, 30 Oct – 6 Nov (UTC)

| When | Event | Evidence |
|---|---|---|
| 30 Oct | AI Studio relief protocol and advisory PR review added | ADR-004, ADR-005 |
| 1 Nov | v3.0 Manager Mode contract locked; v3.1 Haiku baseline; v3.2 Elephant/Goldfish RFC | ADR-008–010 |
| 2–3 Nov | Antigravity builds slices 4.1–6.4 (Atlas, adapter, renames) | `.spec/PROGRESS.md` |
| 3 Nov | Repo made public; operator asks "how do I know it's working?" | retrospective App. B |
| 4 Nov 02:53 | Plugin route proven: harness agents and hooks finally load in threads | PR #46, memory `harness-threads-plugin` |
| 5 Nov 10:28 | Mac dashboard restart begins; classifier denies `kill` | T-RC |
| 5 Nov 16:18 | Operator: harness "eaten up half of my energy and time" | retrospective App. B |
| 5 Nov 17:21 | Operator approves Doctor-first plan, Phases 1–3 | msg `P4HeWov5…`, `DOCTOR_HANDOFF_2026-11-05.md` |
| 5 Nov 17:28–18:44 | Plan PR #73, Phase 1 PRs #74–#77 | PR list |
| 5 Nov 17:45 | Canary: Doctor halt locks the thread out of its own recovery | T-RETRO |
| 5 Nov 18:49 | #78 and #79 collide; main red; #82 restores at 19:00 | PRs #78, #79, #82 |
| 5 Nov 18:51 | Slice 10.3 blocked: stale plugin 0.1.0, finish gate refuses | T-P2 |
| 5 Nov 18:54 | Operator merges #80 with `verify` red: "I'll just merge it. I'm tired of these snags." | T-P2 18:54:22 |
| 5 Nov 21:31 | Snag plan approved (order 10.3, 10.4, 10.5, Stages 1–4) | `SNAG_PLAN_HANDOFF_2026-11-05.md` |
| 5 Nov 21:40 | Canary gates 2 and 3 pass, but only in a nested CLI with a hand-loaded plugin, not a real thread | `PHASE1_CANARY_TRACE_2026-11-05.md` |
| 5 Nov 21:55 | Self-refresh merged (PR #86); takes effect only next session | PR #86 |
| 6 Nov 00:30–00:41 | 10.3 still blocked; operator edits setup script; container predates edit | T-P2 |
| 6 Nov 00:41–01:08 | New thread finds plugin 0.3.0; #89, #93, #94 merge; verify secret unknown; operator: "resolve conflicts and just move forward" | T-C2 |
| 6 Nov 01:33 | Dispatch gate disabled by owner decision (PR #95) | PR #95 |
| 6 Nov 02:03–02:48 | Streamlining: PRs #98–#111, seven gates to warnings | T-SG |
| 6 Nov 02:11–02:22 | #100, #101 merge under operator account; coordinator cannot tell who merged; orders drafts; reverses 2 minutes later | T-SG |
| 6 Nov 02:26 | Classifier denies the slice 11.11 edit (remove Referee checks) despite operator "Yes." | T-SG, msg `55R1PSbm…` |
| 6 Nov 04:13 | Classifier denies the CI-gate edit as "CI bypass"; operator says "Retry" at 04:39; it passes | T-SG, PR #117 |
| 6 Nov 08:22 | Mac dashboard finally restarted, 22 h after the first attempt | T-RC |
| 6 Nov 17:15 | This audit's session: `resume-cached`, plugin 0.3.0, banner still says "Haiku baseline" and "Branch Owner: antigravity" | [container] |

---

## 4. Incidents

Each incident gives what happened, the mechanism, the cost, and evidence.

### INC-1 Stale plugin froze the harness in cached containers
- **What:** threads ran plugin 0.1.0 from 4 Nov 02:39 for more than a day, without the telemetry hook added on 5 Nov.
- **Mechanism:** environments start `resume-cached`; the setup script does not rerun; when it does run, a failed download keeps the old copy and exits 0. Self-refresh (PR #86) only helps the session after next, and only in the hub.
- **Cost:** slices 10.3–10.5 blocked about 6 hours; four handoff documents written; operator asked to edit the environment script; a hypothesis ("a non-whitespace edit forces a rebuild") recorded in memory and still unverified.
- **Still true:** `plugins/harness/setup-script.sh` ends in `exit 0`. This session again reports `resume-cached`. [container]
- **Evidence:** T-P2 18:51–00:41; T-SNAG10.4; `SNAG_THREAD_HANDOFF_10.4.md`; `SLICE_10_4_NEW_SESSION_2026-11-05.md`; `/tmp/env-manager.log`.

### INC-2 Gates failed closed on missing evidence
- **What:** the Doctor halt (slice 10.1) locked a thread out of deleting its own canary file; the finish gate refused commits because no dispatch was recorded; the verify step needed a secret that existed nowhere.
- **Mechanism:** each gate treated absent telemetry as proof of misbehaviour. None had a designed exit except "operator intervenes".
- **Cost:** gate redesign within hours (PRs #75, #76 "bootstrap exception", #95 disable, #97 drop secret), then the wholesale softening in INC-3.
- **Evidence:** T-RETRO 17:45; `dispatch-telemetry-2026-11-06.md`; T-C2 00:59 ("I don't know what the value is", T-C2 00:59:44).

### INC-3 Gate collapse
- **What:** 20 PRs between 02:07 and 04:42 converted the Doctor gate, fast-path budget, main-thread allow-list, goldfish breaker, plan lock and CI slice-membership check to warnings, and disabled the dispatch gate.
- **Mechanism:** reactive. The operator asked for "graceful fallbacks that I can confirm" at 02:11 (msg `ADGCx1R7…`), approved the warn-and-log design at 02:11:44, then "Cut the gates" at 02:24:55. No trial measured whether any warning changed agent behaviour.
- **Cost:** the harness now enforces almost nothing beyond the hard-block list, and the remaining signal is invisible (INC-6).
- **Evidence:** PRs #98–#117; T-SG.

### INC-4 Re-asking and approval churn
- **What:** agents asked the operator to re-confirm decisions already made, or reversed their own instructions.
- **Instances:**
  - Thread offered a force-push card to fix its own branch-name reuse (T-SG 02:08); coordinator overrode it.
  - Coordinator ordered gate PRs held as drafts because #100/#101 merged under the operator's account and it could not tell who merged (02:22), then reversed (02:24) after "I'm merging. It's dumb you always ask when I told you not to."
  - Coordinator told a thread the operator had not approved skipping verify (01:04:30) when he had tapped the card 23 seconds earlier; the thread then asked him to confirm his own tap (01:04:44).
  - Operator's "Yes." to removing Referee checks was recorded but never implemented (INC-7).
- **Mechanism:** approvals live in chat, cards, memory, handoffs, plan files and CLAUDE.md. No agent has one place to check what is already approved, so each one re-derives it and errs toward asking.
- **Evidence:** T-SG; T-C2; msgs `1Hno3aZ…`, `57kTBC…`.

### INC-5 Merge identity never separated
- **What:** the bot-merge workflow (`automerge.yml`, PRs #85/#89) exists, but threads kept calling `merge_pull_request`. Zero PRs in #89–#117 carry the `harness:automerge` label. `merged_by` is `cchonguyen` on every PR checked.
- **Cost:** the coordinator's attribution confusion in INC-4; the 5 Nov retrospective's merge-speed analysis had to be redone from transcripts.
- **Evidence:** GitHub API reads of PRs #89, #100, #101, #111, #117 [re-measured].

### INC-6 Warnings nobody sees
- **What:** every soft gate writes `WARN:` to stderr and an event to `.spec/.events/<session>.jsonl`.
- **Mechanism:** Claude Code does not pass stderr of an exit-0 hook to the model. The event file is gitignored and lives in a container that is reclaimed. `triage-events.mjs` must be run by hand, and its slash command does not load in threads.
- **Proof in this session:** 3 `main_thread_warn` events logged against my own reads; I received none. The event text says "refused" for calls that were allowed. Telemetry counters disagree with each other (10 `totalToolCalls`, 22 `calls`) and with reality (more than 25 calls). [container]
- **Evidence:** `pre-tool-guard.mjs` lines 230–236, 443–449; `.gitignore`.

### INC-7 Classifier denials stall approved work
- **What:** the auto-mode classifier refused (a) `kill <pid>` on the Mac (dashboard restart), (b) editing a spec line that recorded the operator's approval to remove Referee checks, (c) a coder dispatch to soften the CI gate.
- **Cost:** (a) 22 hours of a stale dashboard; (b) slice 11.11 never landed; (c) 26 minutes until the operator typed "Retry".
- **Mechanism:** the harness has no model of the classifier. Approval recorded in a relay or spec file does not reach the classifier; only the operator's own words do.
- **Evidence:** T-RC; T-SG 02:26, 04:13, 04:39; msg `VuBpHP26…`.

### INC-8 Status that lies
- **Banner:** "Model tier: Haiku baseline" printed in an Opus session (`session-start.mjs` line 42). [container]
- **Handoff:** `SESSION_HANDOFF.md` on main said "Last Active Platform: Google Antigravity", listed files from slice 4.4, claimed "Verified via finish-slice.mjs (Slice 11.15)", told the reader to "Run `/clear` then `/pickup`" (not available in threads) and named Antigravity as branch owner. Injected into every session. Corrected in this PR.
- **PROGRESS.md:** 11 merged slices have no `[x]`; ids 10.7 and 11.9 are each used twice; `OVERVIEW.md` "Up Next" predates v3.2.
- **Doctor:** `handoff-fresh` checks existence, `gf-coder-registered` checks a repo file, `spoke-engine-hash` is "not implemented", `fast-path-budget` calls a function in-process. A DOCTOR_PASS says little about the live session.
- **Trailers:** `Telemetry-Dispatches` is still stamped although the dispatch gate is off.
- **Evidence:** `HARNESS_SPEC.md` §8, §14.

### INC-9 Stall prevention is inert
- **What:** the Stop hook (slice 10.5, PR #94) only blocks when `PROGRESS.md` has `- [ ]` or `[IN_PROGRESS]` lines. Current `PROGRESS.md` has 0 such lines because unfinished slices are written without checkboxes. Its escapes depend on environment variables nothing sets.
- **Effect:** the approved fix for the 5 Nov stalls (1 h 54 m, 3 h 08 m, 5 h 42 m) has not been shown to prevent one. Several threads still show "blocked" or "review_ready" although their work merged (thread list, 6 Nov).
- **Evidence:** `stop-guard.mjs`; `grep -cE` on `PROGRESS.md` returns 0 [container].

### INC-10 Coordination debris
- Stacked PRs needed main merged in before each merge (T-SG 02:35); branch-name reuse after squash merges (02:08); parallel threads #78/#79 broke main (PR #82); at least nine handoff files in `/mnt/project-files/harness-hub/handoff/`; a Linear-tracking thread left blocked (T-LIN).

---

## 5. What went well

- **Plugin delivery** solved the 9-day "nothing loads in threads" failure (PR #46). Agents now appear as `harness:*` in every thread with a current plugin.
- **Delegation works when reachable:** every 5 Nov slice went to `gf-coder`; the streamlining thread dispatched coders and an architect for each slice (T-SG 02:03–02:56).
- **Plan-merge approval** (PR #59) gives one approval per plan with a durable record.
- **Derived status** (ADR-011): the hosted page reads GitHub, not agent claims.
- **Small, testable primitives** added this week are sound: append-only event log (PR #98), single hard-block list (PRs #100, #114), lock-safe telemetry writes (PR #92), triage grouping (PR #107).
- **Throughput when unblocked:** #102–#111 merged in order in 18 minutes including conflict resolution.
- **Honest corrections:** threads used visible `[Edit: …]` strike-throughs and a correction section in the dispatch post-mortem (PR #115).
- **Tests:** 327 passing, CI on every PR.

---

## 6. What is missing

1. A durable telemetry sink (events and telemetry survive only inside one container).
2. Any token or model-usage measurement, so N2 cannot be evaluated.
3. A feedback channel the model reads: warnings in `additionalContext` or a summary at SessionStart and Stop.
4. An approval ledger agents must consult before asking.
5. Deterministic delivery: a pinned, verified plugin version per session, and a setup script that fails loudly.
6. A real liveness mechanism: the platform's `send_later` and PR subscriptions exist, but the harness neither records nor checks them.
7. A product trial. Without one, no component has a measured benefit.
8. A merge path that records who merged.
9. A model of the host's safety classifier: which actions it denies, and how an approval reaches it.

---

## 7. Over- and under-engineering

### 7.1 Over-engineered (cost exceeds demonstrated benefit)

| Component | Why it is too much | Hidden assumption |
|---|---|---|
| Four copies of each agent definition plus Antigravity payload compiler | Only `plugins/harness/agents/` loads in threads; copies already drifted | Every platform loads agents from its own folder, and sync keeps them equal |
| Referee trailers with tree and engine SHA-256 | Integrity markers against a threat (an agent forging a verdict) that never occurred; operator approved removing them; caused branch and stamp churn | The adversary is the agent; tamper-evidence beats throughput |
| Context Atlas sector numbering (000–440), Dewey metaphors, Elephant/Falcon/Goldfish naming | Unmeasured whether any agent reads it; adds vocabulary a newcomer must learn; lint checks links, not usefulness | Agents navigate better with a numbered catalogue than with plain paths |
| Three operator surfaces (React dashboard, Command Center, hosted page) | The operator uses the thread; the Mac dashboard took 22 h to restart | The operator wants a dashboard more than he wants fewer interruptions |
| 19 slash commands | 12 unreachable in threads; docs still point agents at them | Repo commands load where the operator works |
| Vibe checkpoints, colour locks, upshift locks, Scout levels | Mostly inert in threads or never seen firing | Fine-grained mode switching pays for its complexity |
| Line budgets measured in lines | `PROGRESS.md` passes at 55 lines and 28 KB | Line count tracks token cost |
| Operator-side verify secret | The operator never had the value | The operator manages secrets and runs scripts |
| Multi-platform baton pass and handoff format | Antigravity has not touched the hub since 3 Nov; the handoff it left misled every session for three days | Several AI platforms work the same repo in turns |

### 7.2 Under-engineered (missing where it matters)

| Need | Current state | Hidden assumption |
|---|---|---|
| Delivery verification | Setup script exits 0 on failure; cached resume skips it | Containers are fresh and downloads succeed |
| Telemetry durability and readership | Container-local, gitignored, read by nobody | Someone will run triage before the container dies |
| Liveness | Stop hook inert; no idle detector | A turn exit is followed by a wake |
| Identity | Shared GitHub account | GitHub merge records identify the actor |
| Approval memory | Scattered across chat, cards, memory, handoffs | Agents will find and trust prior approvals |
| Host-safety model | None | Operator approval in text reaches the classifier |
| Measurement of the north-star outcome | None | Proxy metrics (tests passing, PRs merged) track value |

### 7.3 The deeper pattern
The harness was designed around an imagined runtime (local CLI, repo settings load, persistent disk, one platform at a time, an operator who runs scripts) and then patched incident by incident to fit the real one (cloud threads, user-only settings, cached containers, a classifier, an operator who clicks). Each patch added a rule or a gate, so complexity rose while fit improved only locally. When gates bit, they were removed wholesale rather than redesigned around evidence the host can actually supply.

---

## 8. Root causes

1. **No product in the loop.** All feedback came from building the harness on itself, so every defect looked like a reason to add harness.
2. **Unverified host model.** Design decisions preceded verification of what the host loads, persists and permits (`--setting-sources user`, cached resumes, stderr invisibility, classifier).
3. **Enforcement before observability.** Gates were built before the telemetry they depended on was proven to arrive; the telemetry was then built to serve gates, not the operator.
4. **Approval is not a data structure.** Text rules ("merge green approved work", "don't ask again") cannot be checked mechanically, so agents re-ask.
5. **Fixed-text status.** Banners, handoffs and checkboxes are written by hand or hard-coded, so they rot silently.
6. **Planning cadence.** Seven redesigns in eleven days and a full gate reversal in one night meant no design ran long enough to be measured.

---

## 9. Recommendations

Ordered by expected value per unit of operator attention.

| # | Recommendation | Serves | Effort |
|---|---|---|---|
| R1 | **Freeze harness features and run the Concert-Tracker trial now.** One feature plan, end to end. Measure operator messages per merged product PR, operator minutes, stalls, tokens per PR. | N1–N5 | Low |
| R2 | **Make warnings visible to the model.** Emit gate warnings as `additionalContext` (PostToolUse/SessionStart JSON output) and summarize the session's events in the Stop hook, so the agent self-corrects in the same turn. | N5 | Low |
| R3 | **Ship telemetry off the container.** At `finish-slice` or PR open, attach `triage-events --json` output to the PR body or a comment; a scheduled Action posts a weekly scorecard issue. | N5 | Low–medium |
| R4 | **Make delivery fail loudly and verify itself.** Setup script exits non-zero; SessionStart compares installed plugin version with hub `main` and says so in the first banner line; drop the fixed "Haiku baseline" text. | N4 | Low |
| R5 | **Approval ledger.** One machine-readable file (for example `.spec/approvals.json`) of standing and per-plan approvals; coordinator and threads check it before any decision card; a card is refused when the ledger already covers the action. | N3 | Medium |
| R6 | **Use the bot merge path everywhere or retire it.** If kept: threads label, never call merge; the merge record then separates actors. | N3, N5 | Low |
| R7 | **Generate status, never hand-write it.** Handoff derived from git log and open PRs; slice state derived from merged PRs; Doctor probes test the live session (installed plugin version, hook actually fired this session, agent list). | N4, N5 | Medium |
| R8 | **Prune.** Keep plugin agents only; delete `.claude/agents`, `.harness/agents`, `.agents` copies or generate them; retire Atlas numbering, Referee-Engine hash, the React dashboard, the verify secret and unreachable commands. | N6, N2 | Medium |
| R9 | **Replace the inert Stop hook** with a check the platform can satisfy: record `send_later`/`subscribe_pr_activity` calls in telemetry and block exit only when work is claimed and neither exists. | N3, N4 | Medium |
| R10 | **Measure tokens.** Read `get_session` usage at Stop and log it as an event, so model routing can be judged. | N2 | Low |

What not to do: add new gates before R2–R4 make their signals visible and durable.

---

## 10. Questions for the council

1. **Enforcement vs observation.** Given a stochastic agent in a host that hides hook stderr and kills containers, should the harness enforce anything beyond destructive-action hard blocks, or should it only observe, surface and score?
2. **Where should rules live?** Text in `CLAUDE.md`, hooks in a plugin, checks in CI, or the host's own permission system? Which layer actually changes agent behaviour, and how would you measure it?
3. **What is the right unit of success?** Is "operator messages per merged product PR" the north-star metric, or does it hide quality and token cost?
4. **Is model tiering worth it here?** Total spend was about $40 over two weeks. Is cheap-model routing worth its coordination cost, or should the target be context size and operator attention instead?
5. **Approval semantics.** How should a system represent "the operator already approved this" so that every agent, including the host classifier, honours it, without creating a blanket bypass?
6. **Identity.** Is a bot merge identity necessary when one human owns the repo, or is an event-log record of who merged sufficient?
7. **Multi-platform.** Should Antigravity and AI Studio remain first-class peers, given their last hub activity was 3 Nov and their handoff misled sessions for three days?
8. **Self-healing scope.** Which failures should the harness repair on its own (stale plugin, stale handoff, unticked slices) and which must always reach the operator?
9. **Delivery.** Is a setup-script-installed plugin the right vehicle, or should the harness target the platform's synced-plugin mechanism, accepting slower iteration for deterministic versions?
10. **Design cadence.** Seven redesigns in eleven days. What process would stop the next redesign until the current one has trial data?
11. **What to delete first?** Using section 7.1, which removals carry the least risk and the most clarity?
12. **Is the hub/spoke split earning its keep** with one operator and three to five small repos, or would a single plugin plus per-repo `CLAUDE.md` be enough?

---

## Appendix A. Thread and message index

Prefix every id with `cmsg_017AUYngxmk255BZpRgjhbx4`.

| Key | Id suffix | Title / content |
|---|---|---|
| T-RETRO | `8yiAeXGtKKo8atxqMnXCUr` | Write harness retrospective and forward plan |
| T-P2 | `26pmrcbLaxoW9A6jUAGRdF` | Finish Phase 2 slices 10.3 to 10.5 |
| T-C2 | `7nsDETSXSSuC4MPm8bpuXx` | Continue Phase 2 slices 10.3 to 10.5 |
| T-SG | `D9oAkbs9h3KP6pwhqY11JH` | Implement streamlining plan: soft gates and logging |
| T-RC | `FasjnLvaEt11vSHQMUXQXN` | Reduce manual checkpoints (dashboard restart) |
| T-SNAG | `4tr6odGb4BUXEgUUjM65BT` | Eliminate recurring workflow snags |
| T-SNAG10.4 | `Dzti7Aq2o9C9t4aov6XUH3` | Execute snag plan from handoff |
| T-LIN | `GGTZgmZAq5onJSWcezQoqM` | Track snag plan work in Linear |
| msg | `P4HeWov5KMpZhT55xV8kXu` | 5 Nov 17:21 operator sign-off, Phases 1–3 |
| T-P2 18:54:22 | (user message in T-P2) | 5 Nov "I'll just merge it. I'm tired of these snags." |
| msg | `57kTBCcWAVuJyemudyRZNg` | 6 Nov 01:00 "resolve conflicts and just move forward. Why must everything be so damn annoying" |
| T-C2 00:59:44 | (user message in T-C2) | 6 Nov "I don't know what the value is" |
| msg | `ADGCx1R7Ad6RMEcdGM1qr7` | 6 Nov 02:11 "Soft gates need graceful fallbacks that I can confirm" |
| msg | `1Hno3aZ1c2HsCyRZ1y4yJX` | 6 Nov 02:23 "I'm merging. It's dumb you always ask when I told you not to" |
| msg | `XKgtEAkGVKcrdWGSNm6cox` | 6 Nov 02:24 "Cut the gates and stop asking" |
| msg | `55R1PSbmFBLbaBtQnqndZP` | 6 Nov 02:25 "Yes." (remove Referee and scope-neutrality checks) |
| msg | `PAdbg6RmDqUKDWM2W8d6fB` | 6 Nov 02:30 "Merge them all" |
| msg | `DK6SASCyyebbpcRxNyEzJq` | 6 Nov 02:30 "Turn off the in progress guard" |
| msg | `VuBpHP26x97QUuBsbay71A` | 6 Nov 04:39 "Retry" (relay id) |

## Appendix B. PR index, this week

| PRs | Theme |
|---|---|
| #73–#77 | Phase 1: plan, live Doctor, telemetry gate, bootstrap exception |
| #78–#82 | Spoke Doctor collision, red main and fix |
| #80, #86 | Plugin version stamp; self-refresh |
| #83, #88, #91, #92 | Telemetry routing, slice tag, wiring, lock fix |
| #84 | Referee watch false alarms |
| #85, #87, #89 | Bot merge workflow (never used afterwards) |
| #90 | Auto-merge standing rule in plugin |
| #93, #94 | Main-thread allow-list; Stop hook |
| #95–#97 | Dispatch gate off; status correction; verify secret dropped |
| #98–#117 | Streamlining: event log, heartbeat, hard blocks, seven soft gates, triage, scope bypass, CI warn |

## Appendix C. Method

Threads read through the project API (oldest-first and newest-first pages). PR metadata from the GitHub API on 6 Nov. Code read at `c595c43`. Container facts from this session's `/tmp/env-manager.log`, `~/.claude/skills/harness`, `.spec/.events/`, `.spec/.session-telemetry.json`. Not re-measured: token totals, 5 Nov merge attribution, Concert-Tracker commit counts (from the 5 Nov investigation). Not accessible: spoke repos (private), Antigravity usage, the Mac's local logs.
