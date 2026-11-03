# Protocol Contract: Neutral Referee & Verification Trailers (Dewey 310)

Defines the neutral arbiter protocol, Git commit trailer specification, and tree integrity verification.

## 1. Neutral Arbiter (`referee.mjs`)
`referee.mjs` is a zero-dependency, neutral arbiter that verifies repository health, scope adherence, and slice completion:
- **Scope Neutrality**: Reads target file scope strictly from `HEAD:.spec/PROGRESS.md` via `git show HEAD:.spec/PROGRESS.md`. Workers cannot retrospectively widen scope by editing the working copy.
- **Verification Rule**: Runs the slice's designated verification command and evaluates test coverage rules (e.g. required assertions for `[CORE / DATA]`).
- **Read-Only Operation**: The referee evaluates repository state but never mutates application source code directly.

## 2. Git Commit Trailers
When a slice passes verification, `finish-slice.mjs` formats and commits the slice with three Git trailers:
- `Referee-Verdict: VERIFIED` — Attests that all verification checks passed.
- `Referee-Tree: <tree-sha>` — Tree SHA from `git rev-parse HEAD^{tree}`, locking exact repository content.
- `Referee-Engine: <referee-sha256>` — SHA-256 hash of the `referee.mjs` script that evaluated the slice.

## 3. Audit Marker Threat Model
The `Referee-*` commit trailers operate as deterministic audit markers and tree integrity fingerprints:
- **Post-Verification Tampering**: Verifying `git rev-parse HEAD^{tree}` against `Referee-Tree` guarantees no uncommitted or cherry-picked changes modified the tree after verification.
- **Engine Drift**: The `Referee-Engine` hash ensures verification was performed by the authentic repository referee script rather than a spoofed or outdated engine.
- **Boundary**: These markers guard against workspace mutation, engine drift, and branch skew; they are deterministic repository integrity markers, not public-key identity signatures.

## 4. Zero-Turn Baton Pickup
Downstream agents reading `HEAD` verify `Referee-Verdict: VERIFIED`, clean `git status --porcelain`, and matching `Referee-Tree` to trust prior work without re-executing expensive test suites.
