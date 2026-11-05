# Master Implementation Plan: Vibe Coding Command Center (v2.2)

## Architectural Gate: Conditional Approval Incorporated

**Version:** 2.2 (Defect Remediations & Council Conditions Integrated)  
**Date:** November 2026  
**Status:** Approved for 48-Hour Implementation Spike (OpenBot Sunset Deferred 14 Days)  
**Architecture:** `claude-harness-hub` (Layer 1) + `herdr` (Layer 2) + Forked `claude-task-viewer` (Layer 3)  
**Fork Strategy:** Hard fork of `L1AD/claude-task-viewer` (last upstream push Feb 14, 2026); owned completely with zero upstream rebasing expectations. `herdr` is AGPL-3.0 (permissible for local solo developer execution).

---

## 1. Architectural Corrections & Ownership Boundaries

To eliminate split-brain drift, every data category is assigned a single authoritative owner. No state is duplicated across layers.

### 1.1 State Ownership Matrix (Fixes Defect 1)
| Data Category | Single Authoritative Owner | Storage / Transport | Primary Consumers |
| :--- | :--- | :--- | :--- |
| **Process Liveness & Runtime Attention** (`working`, `blocked`, `idle`, `done`) | **Herdr** (polled every 300–500ms via PTY/foreground process heuristics) | Herdr Unix Socket | Herdr Sidebar, Task Viewer Attention Strip |
| **Epistemic Stage, Slice Intent & Unresolved Decisions** | **Harness + Git Hooks** | `.spec/STATE.json` (Ephemeral, **gitignored** per worktree) | Task Viewer UI (or Herdr Plugin) |
| **Durable Architectural Rationale & Handoffs** | **Lead Agent (`Elephant`) + Human** | `.spec/decisions/*.md` & `.spec/HANDOFF_PACKET.md` (**Git-tracked**) | Human Review, `Falcon` / `Goldfish` Auditors |
| **Test Verification Evidence** | **Deterministic Harness Script (`verify-slice.sh`)** | Executes test command directly; writes exit code + `HEAD` SHA to `.spec/STATE.json` | Task Viewer Epistemic Gate |
| **Final Human Acceptance** | **Human Operator ONLY** | Signed CLI command (`harness accept`) or Token-Protected UI Action | Task Viewer Epistemic Gate |

### 1.2 Git Tracking vs. Ephemeral Worktree State (Fixes Defect 2)
* **Git-Tracked (`.spec/`):** `HANDOFF_PACKET.md`, `decisions/*.md`, and static specs remain tracked in Git so rationale travels with branches and PRs.
* **Gitignored (`.spec/STATE.json`):** `STATE.json` is strictly **ephemeral per-worktree state**. Tracking it in Git causes commit churn, merge conflicts, and branch-checkout time travel (reviving stale state when checking out an old branch).
* **Worktree Discovery:** Fixed globs (`~/projects/*/.spec/STATE.json`) fail on parallel worktrees. The watcher discovers active directories dynamically by running `git worktree list --porcelain` across registered base repositories.

### 1.3 The Elephant-Falcon-Goldfish Operating Model
To prevent autonomous swarm loops, agent responsibilities are strictly partitioned:
1. **Elephant (Lead Session Agent):** Holds slice context, formulates design proposals in `.spec/`, and executes implementation code. **Constraint:** Does NOT install or use the Herdr Agent Skill; cannot spawn peer panes or self-certify verification.
2. **Falcon (Adversarial Spec & Architecture Auditor):** Invoked at the `Falcon-Review` stage before implementation begins. Audits `.spec/HANDOFF_PACKET.md` for scope creep, edge cases, and schema violations.
3. **Goldfish (Zero-Context Code & Diff Reviewer):** Invoked with zero conversational memory at the `Verification` stage. Inspects only the raw `git diff`, test outputs, and specification invariants before human review.

### 1.4 Honest Scope & Traceability Corrections
* **Symptom 2 (Context Recovery):** Only works if `recentDecisions` is populated. The `/wrap` command now **blocks completion** unless at least one trade-off/decision entry is recorded or explicitly marked `none`.
* **Symptom 5 (Premature Delegation):** Solved by existing `claude-harness-hub` pre-flight gates (Elephant-Falcon-Goldfish), not by the new UI stack.
* **Symptoms 7 & 8 (Harness Creep & Friction):** Out of scope for automated resolution during the 48-hour spike. Addressed via manual `/wrap` discipline.

---

## 2. Revised `.spec/STATE.json` Schema Contract (v2.2)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RepoStateContractV2_2",
  "type": "object",
  "required": [
    "schemaVersion",
    "updatedAt",
    "projectId",
    "worktreeId",
    "branch",
    "currentIntent",
    "stage",
    "pendingDecisions",
    "recentDecisions"
  ],
  "properties": {
    "schemaVersion": { "type": "string", "enum": ["2.2"] },
    "updatedAt": { "type": "string", "format": "date-time" },
    "projectId": { "type": "string", "example": "music-visualizer" },
    "worktreeId": { "type": "string", "example": "music-visualizer-bloom" },
    "branch": { "type": "string", "example": "feature/bloom-tuning" },
    "currentIntent": { "type": "string", "example": "Stage 2.5: Shader bloom threshold & reactive particles" },
    "stage": {
      "type": "string",
      "enum": [
        "Design",
        "Falcon-Review",
        "Implementation",
        "Claimed",
        "Verified",
        "Accepted"
      ],
      "description": "Single unified epistemic progression. 'Verified' can only be set by verify-slice.sh. 'Accepted' can only be set by human action."
    },
    "activeSlice": {
      "type": "object",
      "description": "Optional during Design stage; required from Falcon-Review onward.",
      "required": ["id", "title"],
      "properties": {
        "id": { "type": "string", "example": "slice-14" },
        "title": { "type": "string", "example": "WebGL2 bloom pass tuning" }
      }
    },
    "pendingDecisions": {
      "type": "array",
      "description": "Unresolved human architectural/product decisions. Distinct from Herdr runtime terminal blocks.",
      "items": {
        "type": "object",
        "required": ["id", "prompt", "contextFile", "createdAt"],
        "properties": {
          "id": { "type": "string", "example": "dec-04" },
          "prompt": { "type": "string", "example": "Approve half-float framebuffer fallback on integrated GPUs?" },
          "contextFile": { "type": "string", "example": ".spec/decisions/dec-04-gpu-fallback.md" },
          "createdAt": { "type": "string", "format": "date-time" }
        }
      }
    },
    "verification": {
      "type": "object",
      "description": "Populated exclusively by the external verify-slice.sh runner, never by agent self-assertion.",
      "required": ["testsPassing", "exitCode", "testCommandRun", "evidenceCommitSha", "verifiedAt"],
      "properties": {
        "testsPassing": { "type": "boolean" },
        "exitCode": { "type": "integer" },
        "testCommandRun": { "type": "string", "example": "npm test -- --run" },
        "evidenceCommitSha": { "type": "string", "example": "e4f81c9" },
        "verifiedAt": { "type": "string", "format": "date-time" },
        "evidenceSummary": { "type": "string" }
      }
    },
    "recentDecisions": {
      "type": "array",
      "description": "Populated by mandatory /wrap prompt. Links to tracked .spec/decisions/ files.",
      "items": {
        "type": "object",
        "required": ["id", "timestamp", "tradeoff", "decision", "contextFile"],
        "properties": {
          "id": { "type": "string", "example": "dec-03" },
          "timestamp": { "type": "string", "format": "date-time" },
          "tradeoff": { "type": "string" },
          "decision": { "type": "string" },
          "contextFile": { "type": "string", "example": ".spec/decisions/dec-03-audio-fft.md" }
        }
      }
    }
  }
}
```

---

## 3. Master Execution Schedule (48-Hour Spike)

### Phase 0: Pre-Flight Audit & Non-Destructive Freeze (Hour 0–1)
* **Containerized Browsers:** Confirmed verification for target apps (`music-visualizer`, `LiveArchive`) uses local browser/Vitest runners.
* **Database Backup:**
  ```bash
  mkdir -p ~/backups/openbot-sunset-$(date +%Y%m%d)
  docker exec openbot-postgres pg_dumpall -U postgres > ~/backups/openbot-sunset-$(date +%Y%m%d)/openbot_full_dump.sql
  docker compose -f ~/projects/openbot/docker-compose.yml stop
  ```
* **Gate 0:** Database dumped; containers stopped without deleting volumes. 14-day hold active until Nov 18, 2026.

### Phase 1: Herdr Standalone Trial & Induced Accuracy Test (Hours 1–5)
* Install Herdr: `brew install ogulcancelik/tap/herdr`
* **Do NOT install the Herdr Claude Agent Skill.**
* Run 4-hour dogfooding across two repositories.
* Verify 4 induced states: `working`, `blocked`, `idle`, and `subshell spinner` (Vitest watcher).

### Phase 2: Git Hooks, Verification Runner & State Automation (Hours 6–9)
* Deploy `schemas/state-v2.2.schema.json`.
* Deploy `bin/update-state.mjs` (atomic state updates, schema compliance).
* Deploy `bin/verify-slice.sh` (runs tests, captures SHA, sets `Verified`).
* Deploy `bin/accept-slice.sh` (human interactive acceptance).
* Deploy `hooks/git-post-checkout` (syncs `branch` and `worktreeId` automatically on checkout).

### Phase 3: Hardened Task Viewer Fork & Worktree Watcher (Hours 10–13)
* Hard fork `L1AD/claude-task-viewer` into `~/projects/vibe-command-center`.
* Bind HTTP server strictly to `127.0.0.1`.
* Implement per-session `X-Command-Token` and check Origin/Host headers.
* Canonicalize paths via `fs.realpathSync` to prevent traversal.
* Discover worktrees dynamically via `git worktree list --porcelain`.

### Phase 4: Unified Attention Strip & Epistemic Gate UI (Hours 14–18)
* Top Attention Strip displays Herdr process state alongside `STATE.json` epistemic stage.
* Real-time commit drift check: if `evidenceCommitSha !== currentHeadSha`, demote badge to `EVIDENCE STALE`.
* Staleness indicator for inactive sessions older than 30 minutes.

### Phase 5: Real-World Dogfooding & Falsifiable Metrics (Hours 19–48)
* Track three metrics in `SPIKE_METRICS.md`:
  1. Terminal Status Polls ($\le 2$ per 4h)
  2. Interruption Recovery Latency ($< 30$ seconds)
  3. State Contradictions ($0$ unresolved)
* Hour 48 Evaluation: Proceed to full sunset or execute two-way door rollback.
