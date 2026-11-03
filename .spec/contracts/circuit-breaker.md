# Protocol Contract: Circuit Breakers & Crime Scene Protocol (Dewey 320)

Defines operational thresholds, retry boundaries, and failure isolation for autonomous agents.

## 1. Search Budget (2-Search Limit)
Goldfish agents operate with strict context boundaries:
- A maximum of 2 exploratory searches (grep/glob/search) per slice implementation.
- Prevents context bloat, token wastage, and rabbit-hole exploration.
- If target locations cannot be identified within 2 searches, escalate or triage.

## 2. Mutating Call Ceiling (15-Call Soft Nudge)
- Mid-slice telemetry tracks mutating calls (`Edit`, `Write`, `Bash`).
- Reaching 15 mutating calls emits a 1-line soft advisory nudge via `post-tool-scrub.mjs`.
- Warns the agent to pause, consolidate edits, run tests, and avoid churn.

## 3. Verification Strikes (2-Strike Hard Limit)
When running the slice verification command:
- **Strike 1 (First Failure)**: Agent performs a targeted fix strictly within declared `Target files:`.
- **Strike 2 (Second Failure)**: Halts implementation immediately. The circuit breaker trips and initiates the freeze protocol.

## 4. Crime Scene Freeze Protocol
Upon Strike 2, the agent must run `freeze-crime-scene.mjs`:
- Generates `.spec/CRIME_SCENE.md` documenting:
  - Active slice ID and failing command.
  - Test output and failure symptoms.
  - Stash reference and suspect files.
- Preserves working state via `git stash push -m "crime-scene/<slice-id>"`.
- Reverts working copy to the slice commit anchor.
- Emits a failure receipt to the dispatcher and halts without looping.
