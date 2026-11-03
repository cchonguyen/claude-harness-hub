# Protocol Contract: Dual-Platform Baton Pass (Dewey 330)

Defines asynchronous handoffs and cross-platform relay protocols between Claude and Antigravity/Gemini.

## 1. Dual-Platform Handoff Manifest (`.spec/SESSION_HANDOFF.md`)
Cross-session and cross-platform state is recorded in `.spec/SESSION_HANDOFF.md`:
- Active milestone, current slice, and git commit anchor.
- Branch ownership declaration.
- Audit status: `[CLEAN | NEEDS_CHANGES | AUDIT_PENDING | none]`.
- Specific next step instruction for the incoming agent.

## 2. Branch Ownership Rules
- `Branch Owner: claude | antigravity` is explicitly declared in `SESSION_HANDOFF.md`.
- Only the designated branch owner may push directly to that branch.
- The peer platform works in a dedicated branch (`antigravity/<slice>` or `claude/<slice>`) or provides feedback via PR reviews and `.spec/AUDIT_VERDICT.json`.

## 3. Zero-Turn Baton Pickup
On `/pickup` or session resumption:
- The incoming agent runs `baton-pickup.mjs`.
- If `HEAD` carries `Referee-Verdict: VERIFIED`, working tree is clean, and `Referee-Tree` matches `git rev-parse HEAD^{tree}`, prior verification is trusted.
- The agent advances immediately to the next slice queue item without re-running previous test suites.
