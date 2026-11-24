# Plan: harness-lean-followups
- slice: 20.241
- slice: 20.242

The open decisions from `docs/AUDIT_2026-11-24.md` sections 2 and 3, settled. Charlie approved the recommendations on 2026-11-24 ("Approved. Proceed with recommendations"). Slice 20.239 (setup script warning, PR #240) was the first of them and is already merged.

- **20.241:** retire `automerge.yml` (unused since #89; threads merge with `merge_pull_request`). Retire Slice 11.11: `finish-slice.mjs` and `--restamp` stamp the Referee trailers, so the checks cost nothing and stay. The hub does not run the slice gate on its own PRs, for good: `pr-check` already runs the tests, and the gate's slice and trailer rules are a spoke contract. Rule text changes from "not yet" to "does not".
- **20.242:** keep `dashboard/` (derived state, ADR-011) and retire the React app (`server.ts`, `src/`), which holds the hard-coded tab badges.

Left for later, low priority: alias keys (audit section 3, row 9) and the slash commands threads cannot load (row 10).
