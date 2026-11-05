# Spike Dogfooding Metrics Log (Day 2: Hours 19–48)

## Purpose & Falsification Criteria
The 48-hour spike is approved as an empirical test of whether the **Zero-Database, Local-First Project Management Control Plane** (`claude-harness-hub` + `herdr` + forked `claude-task-viewer`) genuinely eliminates the supervisory tax and split-brain drift without introducing new friction.

To prevent declaring success while drift persists, the spike must be evaluated against these three **falsifiable criteria**:

---

## Metric 1: Unprompted Terminal Status Polls
* **Definition:** How many times the operator switches to or focuses a terminal pane *solely* to check whether Claude Code is still working, finished, or blocked on input.
* **Pass Threshold (GO):** $\le 2$ times per 4-hour block.
* **Fail Threshold (NO-GO / Pivot):** $> 5$ times per 4-hour block (indicates the visual attention strip or Herdr sidebar is not trusted or legible).

| Time Block | Target Repositories / Worktrees | Terminal Status Poll Count | Primary Cause / Reason for Polling | Status (PASS / FAIL) |
| :--- | :--- | :---: | :--- | :---: |
| **Block 1 (Hours 19–22)** | `music-visualizer` (main) | | | |
| **Block 2 (Hours 23–26)** | `music-visualizer` (feature worktree) | | | |
| **Block 3 (Hours 27–30)** | `LiveArchive` (main) | | | |
| **Block 4 (Hours 31–34)** | Cross-repo concurrent runs | | | |
| **Block 5 (Hours 35–38)** | Final integration & slice closure | | | |

---

## Metric 2: Interruption Recovery Latency
* **Definition:** After an interruption of $\ge 15$ minutes (e.g., meeting, break, switching context), the elapsed time (in seconds) required for the operator to reconstruct: (1) what slice was active, (2) the current epistemic stage, and (3) the immediate next decision or action required.
* **Pass Threshold (GO):** $< 30$ seconds using the visual UI / Attention Strip without reading terminal scrollback.
* **Fail Threshold (NO-GO / Pivot):** $> 120$ seconds or requiring manual terminal history inspection.

| Interruption Event # | Interruption Duration | Elapsed Recovery Time (sec) | Information Source Used (UI / STATE.json / Terminal Scrollback) | Recovery Success? (<30s) |
| :---: | :---: | :---: | :--- | :---: |
| **Event 1** | | | | |
| **Event 2** | | | | |
| **Event 3** | | | | |
| **Event 4** | | | | |

---

## Metric 3: Herdr vs. STATE.json Contradictions
* **Definition:** Any instance where Herdr's detected runtime process state (`working`, `blocked`, `idle`) and `STATE.json`'s epistemic stage (`Implementation`, `Claimed`, `Verified`, `Accepted`) produce a conflicting or false state in the UI.
* **Pass Threshold (GO):** $0$ unresolved contradictions (staleness indicators accurately flag inactive sessions).
* **Fail Threshold (NO-GO / Pivot):** $\ge 2$ contradictions requiring manual JSON editing or debugging.

| Incident # | Timestamp | Herdr Process State | STATE.json Stage | Nature of Contradiction | Root Cause & Resolution |
| :---: | :---: | :---: | :---: | :--- | :--- |
| **1** | | | | | |
| **2** | | | | | |

---

## Final Post-Spike Decision Gate (Hour 48)

* [ ] **Metric 1 Passed:** Polling was minimized; operator trusted visual attention strip.
* [ ] **Metric 2 Passed:** Recovery latency remained $<30$ seconds.
* [ ] **Metric 3 Passed:** Zero split-brain state contradictions occurred.
* [ ] **Epistemic Gate Integrity:** Zero tasks marked as `Verified` without passing tests; zero marked as `Accepted` without human confirmation.
* [ ] **Worktree Watcher:** Parallel git worktrees were tracked with zero missing states or CPU spikes.

### Final Verdict:
* [ ] **PERMANENT GO:** Proceed with full OpenBot decommissioning at the end of the 14-day freeze period (November 18, 2026).
* [ ] **REVISE & EXTEND:** Address specific terminal output parsing regex or UI latency bugs.
* [ ] **ROLLBACK:** Restore OpenBot from `~/backups/openbot-sunset-*/` backup database.
