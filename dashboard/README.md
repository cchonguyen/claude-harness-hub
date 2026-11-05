# Harness Hub dashboard

This folder holds the two status views for the harness, plus the libraries behind them.

## Command Center (local)

`dashboard/command-center.mjs` is the local Command Center. It runs on port 3456 and reads Git and GitHub to show slice state, open pull requests, and freshness or contradiction warnings. It serves `dashboard/index.html` with a per-run token placeholder. Acceptance clicks happen here ("Accept Verified Slice" at http://127.0.0.1:3456/). The verify secret lives only on the operator's machine.

## Hosted status page (read-only)

`dashboard/status-page.html` is the read-only hosted page. It has no build step, no external scripts, no tokens, and makes no `/api` calls.

`.github/workflows/status-snapshot.yml` builds it every 5 minutes:

1. It runs `dashboard/lib/snapshot.mjs`, which writes `dashboard/site/status.json`.
2. It copies `dashboard/status-page.html` to `dashboard/site/index.html` and publishes `dashboard/site` to GitHub Pages.

If the snapshot cannot read GitHub, it still writes `{ ok: false, error, fetchedAt }`. The page then shows a red "cannot see GitHub" banner.

The hosted page reloads `status.json` every 60 seconds. The snapshot it shows can be up to 5 minutes old. Past that age, the page shows the stale banner. It re-renders the "fetched N ago" footers every 15 seconds.

The page shows slices grouped by status (in progress, open, merged), a "pushed, not on main" section, and a contradiction strip. The strip is a simple client-side check of three rules from `dashboard/lib/contradictions.mjs`.

## Operator dashboard (separate)

`server.ts` and the React app in the repo root are the separate operator dashboard from ADR-006. They are not part of this folder's pages and are not deployed by the status-snapshot workflow.

## Libraries

- `lib/progress.mjs` parses slice lines from `.spec/PROGRESS.md`.
- `lib/github.mjs` reads pull requests and check runs.
- `lib/derive-state.mjs` derives slice and pushed-only cards from already-fetched inputs. It does no I/O.
- `lib/contradictions.mjs` holds the freshness and contradiction rules.
- `lib/snapshot.mjs` builds the snapshot file used by the hosted page.

Run the tests from the repo root:

```
node --test dashboard/lib/*.test.mjs
```
