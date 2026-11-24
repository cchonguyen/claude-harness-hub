# Plan: harness-lean
- slice: 20.1
- slice: 20.2
- slice: 20.3
- slice: 20.4
- slice: 20.5
- slice: 20.6
- slice: 20.7
- slice: 20.8
- slice: 20.9
- slice: 20.10

Make the harness smaller and easier to trust without losing what works. Approved by Charlie on 2026-11-24 ("Let's go with your recommendations ... simplify whenever possible, remove friction or redundancy, and keep the harness lean and adaptable"), after the audit in `docs/AUDIT_2026-11-24.md` (PR #210). Slice ids continue after 19.209.

## What we have learned
**Works, keep it:**
- Plan-merge approval and on-the-fly slices: one approval, then work runs to the end.
- `finish-slice.mjs` with Referee trailers, and warn-and-record (`Scope-Widened:`) instead of refusing.
- A short hard-block list for actions that cannot be undone. Everything else warns.
- The Stop hook, once it was tested against real stalled transcripts.
- Issue labels and status set by workflows, not by hand.

**Does not work, stop doing it:**
- Copies of the same thing: rules in two or three files, agents in five places, the Atlas table in three. Copies drift, and the copy that runs is often the one nobody updated.
- Warnings the model never sees (stderr only). If a warning matters, it goes in additionalContext; if not, it goes only to the event log.
- Text that describes a stricter harness than the code. Agents act on the text.
- Paths that only work locally (slash commands, `.claude/agents/`, the v2.2 Command Center) presented as if they work in threads.
- Repeating the same CI work several times per PR.

## Rules for this stage
- Prefer deleting or pointing to one source over adding machinery.
- No behaviour change to a hard block or lock. Wording, duplication and config only, unless a slice says otherwise.
- Each slice is one pull request, merged when green. Engine changes reach spokes through the usual sync after the stage.

## Slices
- **20.1** One CI workflow for hub PRs (#211). Keep `Harness PR check`, add the push-to-main trigger, retire `Harness verify` and `Quick checks`.
- **20.2** One source for agent definitions (#212). `plugins/harness/agents/` is the source; `hub-sync.mjs` generates the other copies.
- **20.3** One home for each rule (#213). The AGENTS.md harness block keeps the role line and points to `.claude/harness-rules.md`.
- **20.4** One Atlas table (#214). `docs/CONTEXT_ATLAS.md` and `README.md` link to `.spec/ATLAS.md`.
- **20.5** Hook messages say what actually happens (#215). No "refused" for calls that go ahead, no unreachable commands in messages, no stale allow-list entries, no duplicate threshold keys.
- **20.6** `/learn` writes the spoke's own rules file (#216).

- **20.7** One way to close a slice (#221). Retire `bin/verify-slice.sh`, `bin/accept-slice.sh`, `/wrap` and the gf-coder `update-state` close steps.
- **20.8** Retire the STATE.json writer (#222). `bin/update-state.mjs`, `hooks/git-post-checkout`, the v2.2 schema, and the Command Center endpoints that use them.
- **20.9** Retire the v3.1 agents and upshift routing (#223).
- **20.10** One telemetry store (#224). Stop writing `STATUS_BATCH.jsonl`; `.spec/.events/` is the record.

Slices 20.7 to 20.10 were added after Charlie chose "Retire them" on the decision card (2026-11-24 14:51 UTC).

## Left for a separate decision
- Which dashboard to keep, whether Slice 11.11 is still wanted, and whether the hub should run the slice gate on its own PRs.
