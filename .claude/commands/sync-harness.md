---
description: Pull or push global harness rules and scripts with claude-harness-hub
allowed-tools: Bash(node *)
disable-model-invocation: true
---
Sync status: !`node "${CLAUDE_PROJECT_DIR}/.harness/scripts/hub-sync.mjs" pull`
Output the 1-line status above. If a `Needed from you:` setup step is returned, display it verbatim.
