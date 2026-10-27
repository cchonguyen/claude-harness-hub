---
description: Record a new permanent operator rule into .claude/harness-rules.md and sync to hub
argument-hint: [rule in plain English]
allowed-tools: Bash(node *), Edit, Write, mcp__github__create_pull_request
disable-model-invocation: true
---
1. Concisely append the following learned operator preference under `## Learned Operator Rules` in `.claude/harness-rules.md`:
$ARGUMENTS
2. Write the 1-line rule summary into `.spec/.learn-staging.txt` using the `Write` tool (avoids shell quoting issues).
3. Run `node "${CLAUDE_PROJECT_DIR}/.harness/scripts/hub-sync.mjs" push`.
4. If it prints `HUB_BRANCH_PUSHED repo=<owner/repo> branch=<branch> base=<base>`, open a pull request for that branch into `<base>` with the GitHub MCP `create_pull_request` tool (title: the rule summary).
5. Output a 1-line receipt: rule added to `.claude/harness-rules.md`, plus "PR opened: <url>" when step 4 ran. If the script printed `HUB_NOT_ATTACHED`, show its `Needed from you:` block verbatim instead.
