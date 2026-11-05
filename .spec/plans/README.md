# Plan files

A plan file in this folder is the operator's approval for the slices it lists.
Merging the pull request that adds it accepts those slices automatically
(the `accept-plan` workflow marks them `[x]` in `.spec/PROGRESS.md` on `main`).

Format:

```
# Plan: <id>
- slice: 8.3
- slice: 8.4
```

- The first line names the plan. Each `- slice:` line names one slice in `.spec/PROGRESS.md`.
- Other lines are ignored, so a short note is fine.
- If a listed slice is not in `.spec/PROGRESS.md`, the workflow fails and nothing is accepted.

Plan acceptance does not use the dashboard Accepted stage or the verify key.
Neither is involved, and no per-slice accept step is needed.
