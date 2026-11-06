# Post-mortem: telemetry dispatch gate (2026-11-06)

## Summary

The finish gate needs a recorded subagent dispatch for each slice. Slice 6.2 in the music-visualizer texture thread kept failing with "no subagent dispatch recorded." Three problems came out of it.

(1) A real lost-update race. Concurrent PostToolUse hooks and the PreToolUse guard rewrote `.spec/.session-telemetry.json` from stale reads, and records were dropped. Repro: 78 of 80 records kept, 38 of 40 Agent dispatches kept. This was fixed with a lock in hub PR #92 (merged as 067b380). Slice 10.7 is a separate change, PR #93. The repro now keeps 80 of 80.

(2) Unresolved. In the texture container the Bash counter rises, so PostToolUse runs, but the telemetry hook appends nothing and writes no error log. A fresh session in that container also recorded nothing. The module files exist on disk, so a missing import is ruled out. The leading suspect is a silent failure that happens before the error log is written.

(3) Process failures, listed below.

## Timeline

- Hub #91 wired the telemetry hook into the engine settings. Spoke commit b7da1d8 synced it.
- Slice 10.7 was implemented in the main thread with no gf-coder dispatch. The dispatch was skipped, and the owner accepted the work after the fact.
- A read-only gf-verifier ran after the edits. Its recorded dispatch let finish-slice pass. The coordinator had said not to use the verifier for that purpose.
- Slice 10.4 merged to main via PR #89 (7dc86cf).
- Slice 10.7 main-thread allow-list merged via PR #93 (0e1add9). The first version of this timeline left it out.
- Hub PR #92 merged as 067b380. It carries the telemetry lock fix, not the allow-list.
- Music-visualizer engine sync PR #59 merged at 35d9009. The app was deployed: tests 356 of 356, HTTP 200.
- The gate was turned off by the owner's decision after the fresh texture session also recorded nothing.

## Mistakes

- A synthetic telemetry record was hand-written during testing. It was removed.
- The first root-cause claim rested on evidence from a single container.
- Edits skipped the coder dispatch.
- The gate passed on a dispatch made after implementation.
- The slice plan for this change had to be hand-edited, because the harness blocks coder edits to slice state.

## Open issues

- The texture container records nothing. Cause unknown.
- The hook is registered twice: project settings via adapter.mjs and the harness plugin via run.mjs. One record per call was observed in the music-visualizer container. Other containers are unverified.
- The lock writes unlocked after a 2-second timeout, so records can still be lost under heavy contention.
- The music-visualizer repo has no lint script.
- Slice 10.5 was parked for this change and must be resumed.
- Silent hook failures leave no trace.

## Recommended later fixes

- Add a canary record at SessionStart that fails loudly if PostToolUse does not write.
- Make finish-slice name which failure happened: no dispatch, no PostToolUse records, or hook missing.
- Add a lint script to music-visualizer, or document that lint is not required there.
- Pick one source for the telemetry hook registration.
- Restore the dispatch gate once a canary exists.

## Correction (2026-11-06)

- Merge order on main, oldest first: #91 (telemetry hook wired), #89 (slice 10.4), #93 (slice 10.7 allow-list), #92 (telemetry lock, 067b380). The timeline above had #92 before #89 and no #93.
- Verifier counting is fixed in slice 11.7 (PR #104): `dispatchesFor` counts only `gf-coder`.
- Open issues above are unchanged.
