# Plan: harness-doctor-phase2
- slice: 10.3
- slice: 10.4
- slice: 10.5

Phase 2 of the harness remediation, approved by Charlie in the retrospective thread after PR #75 merged (2026-11-05). Source: DOCTOR_HANDOFF_2026-11-05.md. Phase 3 needs a new approval.

Design notes:
- 10.3: main-thread Bash is limited to git, test/typecheck/lint, finish-slice, doctor and read-only gh and status commands. Edit, Write and NotebookEdit outside .spec/ are refused unless the payload carries agent_type.
- 10.4: threads label a PR `harness:automerge` plus `plan:<plan-id>`. The automerge workflow checks the plan file, waits for checks, and merges with GITHUB_TOKEN, so merged_by is github-actions[bot]. Because GITHUB_TOKEN merges do not start push workflows, the workflow runs the reconcile and triggers the status snapshot itself.
- 10.5: a Stop hook blocks ending a turn while an approved plan has unfinished slices unless a wake was scheduled (send_later) or a PR subscription exists. bin/restart-dashboard.sh replaces raw kill for the dashboard.
