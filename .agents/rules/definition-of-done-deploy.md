# Rule: Definition of Done — Ship to Production

When completing code changes in a repository that deploys automatically from `main`:

1. **True Definition of Done**:
   - Do not report a task as "done" after local edits or a local commit alone.
   - A task is done only when changes are committed on a clean branch off `origin/main`, opened as a pull request, passing required CI checks, merged into `main`, and verified live on the production deployment (for example, `Workers Builds` or the production deploy check reports `completed / success`).

2. **Zero Local Deploys**:
   - Never run `wrangler deploy` or `npm run deploy` locally from a working tree. Production deployments must go through the PR-to-`main` pipeline.

3. **Keep Feature PRs Clean of Harness Tripwires**:
   - Do not bundle `hub-sync.mjs pull` updates or `AGENTS.md` edits into feature PRs in harness-managed spoke repos, as `pr-scope-check.mjs` flags hub-owned engine files and `AGENTS.md` as Red tripwires. Sync harness updates in a dedicated PR instead.

4. **Exceptions**:
   - Stop before merging or deploying only if the user explicitly asks for local-only changes, a draft PR, or a review before merge, or if a blocking CI check fails.
