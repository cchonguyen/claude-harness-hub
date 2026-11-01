## Harness rules for external agents (managed by the harness; edit in claude-harness-hub)

Before you change this repo, read `.spec/EXTERNAL_AGENT_RULES.md`. It is the full contract.

Five rules that always apply:
1. Read `.spec/SESSION_HANDOFF.md` and check `Branch Owner`. Push only to a branch you own. If the owner is someone else, open `antigravity/<slice>` or post a PR review comment instead.
2. Never commit or push directly to `main`.
3. Run `node .harness/scripts/pr-scope-check.mjs` before any commit or PR merge.
4. Do not start a new slice while origin has the tag `harness-main-red` (`git ls-remote --tags origin harness-main-red` prints a line). Fixing main is the only work until it is gone.
5. Never merge a PR with a red or missing check.
