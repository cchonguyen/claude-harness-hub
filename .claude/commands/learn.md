---
description: Record a new permanent operator rule into .claude/harness-rules.md and sync to hub
argument-hint: [rule in plain English]
allowed-tools: Bash(node *), Edit, Write
disable-model-invocation: true
---
1. Concisely append the following learned operator preference under `## Learned Operator Rules` in `.claude/harness-rules.md`:
$ARGUMENTS
2. Write the 1-line rule summary into `.spec/.learn-staging.txt` using the `Write` tool (avoids shell quoting issues).
3. Run `node "${CLAUDE_PROJECT_DIR}/.harness/scripts/hub-sync.mjs" push`.
4. Output a 1-line receipt confirming the rule was added to `.claude/harness-rules.md` and synced.
