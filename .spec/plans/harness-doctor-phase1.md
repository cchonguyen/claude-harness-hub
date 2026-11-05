# Plan: harness-doctor-phase1
- slice: 10.1
- slice: 10.2

Phase 1 of the harness remediation approved 2026-11-05 17:21 UTC. Source: DOCTOR_HANDOFF_2026-11-05.md and RETROSPECTIVE.md. Phases 2 and 3 need a new approval.

Design notes:
- Doctor state lives in /tmp/harness-session-state.json (DOCTOR_PASS or DOCTOR_FAIL, failing check name, HEAD sha). PreToolUse refuses Edit, Write, NotebookEdit and non-allow-listed Bash unless the state is DOCTOR_PASS for the current HEAD. A changed HEAD re-runs the probes.
- SessionStart no longer resets .spec/.session-telemetry.json. Telemetry is append-only so it survives process restarts.
- Canary: a marker file `.spec/.doctor-canary` names one probe to force-fail. The gate creates it, shows the refusal, and deletes it.
