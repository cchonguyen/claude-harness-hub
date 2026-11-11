# Plan files

A plan file in this folder is the operator's approval for the slices it lists.
Merging the pull request that adds it records that approval. It does not change
slice status in `.spec/PROGRESS.md`. A slice is done when its own pull request is merged.

Format:

```
# Plan: <id>
- slice: 8.3
- slice: 8.4
```

- The first line names the plan. Each `- slice:` line names one slice in `.spec/PROGRESS.md`.
- Other lines are ignored, so a short note is fine.
- After a plan lands on `main`, the `accept-plan` workflow checks that every listed slice exists
  in `.spec/PROGRESS.md` and writes the result to the job summary. It writes nothing else.
  If a listed slice is missing, the job fails so it is visible.

Plan acceptance does not use the dashboard Accepted stage or the verify key.
Neither is involved, and no per-slice accept step is needed.
