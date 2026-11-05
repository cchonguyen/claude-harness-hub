---
description: Record slice start, blockers, and completion in the dashboard state (.spec/STATE.json) for the current repo.
allowed-tools: Bash(node ~/Projects/harness-hub/claude-harness-hub/bin/update-state.mjs*), Bash(~/Projects/harness-hub/claude-harness-hub/bin/verify-slice.sh*)
disable-model-invocation: true
---
Apply the dashboard and slice tracking rules in CLAUDE.md ("Dashboard and slice tracking (required)"):
1. Starting a slice or milestone: run update-state.mjs with `--slice-id`, `--slice-title`, `--intent`, and `--stage Implementation`.
2. Blocker or human decision needed: run update-state.mjs with `--add-decision '<id>:<question>:<contextFile>'`.
3. Coding complete: run update-state.mjs with `--stage Claimed`, then run `~/Projects/harness-hub/claude-harness-hub/bin/verify-slice.sh`, then ask the user to click "Accept Verified Slice" on the dashboard.
Report each command's exact output. Do not set Verified or Accepted by hand.
