# SESSION HANDOFF

Shared template for Claude Code, Google Antigravity, and Google AI Studio. Every platform overwrites this file with the same five fields, in this order, before it pushes.

- **Last Active Platform:** Claude Code Web
- **Active Branch / State:** `claude/project-thread-chwsln`. Adds the unified external co-development protocol: `.spec/EXTERNAL_AGENT_RULES.md` as canonical contract, `.spec/AI_STUDIO_RULES.md` as alias, ingest-on-return steps in `.claude/harness-rules.md`, and the shared handoff template in `.claude/commands/checkpoint-handoff.md`. PR into `main` open for review.
- **Files Modified in Last Turn:** `.spec/EXTERNAL_AGENT_RULES.md`, `.spec/AI_STUDIO_RULES.md`, `.spec/SESSION_HANDOFF.md`, `.spec/OVERVIEW.md`, `.spec/DECISIONS.md`, `.claude/harness-rules.md`, `.claude/commands/checkpoint-handoff.md`, `.harness/scripts/hub-sync.mjs`, `server.ts`
- **Verification Status:** See the PR body for the exact checks and their results.
- **Immediate Next Step for Claude:** Review and merge the PR into `main`, then run `/implement` or `/triage` for the next idea. No slice is active (Vibe Mode).
- **Active Slice:** none (Vibe Mode)
