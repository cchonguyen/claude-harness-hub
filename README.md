# Claude Harness Hub (`v2.2.0`)

Control plane dashboard and authoritative source of truth for the Claude Code v2.2.0 Agent Harness (`.claude/`, `.harness/`, `.spec/`, `CLAUDE.md`).

## Quick Start

1. `npm install`
2. `npm run dev`
3. Open `http://127.0.0.1:3000` (port `3000`)

## Dashboard Tabs (One-Line Purpose)

- **State Machine & Slices (`overview`)**: Shows the "What's next" action line, current work mode (`Vibe` vs `Slice`), checkpoint status, `SESSION_HANDOFF.md` summary, and `.spec/PROGRESS.md` task locks.
- **Runner Matcher Lab (`runner`)**: Classifies shell commands against `runner-matcher.mjs` rules (without running arbitrary input) and executes allow-listed harness checks with persistent test output.
- **Subagents (`agents`)**: Inspects the model-routed subagent definitions (`architect`, `auditor`, `discovery`, `engineer`) inside `.claude/agents/`.
- **Slash Commands (`commands`)**: Browses the zero-token and workflow slash commands defined in `.claude/commands/`.
- **Handoff Bundler (`handoff`)**: Builds `.spec/HANDOFF_PACKET.md` for zero-cost Gemini audits, displaying line counts, included files, staleness warnings against `PROGRESS.md`, and the last copied packet across refreshes.
- **.spec & Rules Studio (`specs`)**: Edits project-owned `.spec/*` and `CLAUDE.md` contracts with file ownership labels, unsaved-change warnings, and a pre-save line diff preview.
- **Spoke Sync & Bootstrap (`spoke`)**: Verifies whether the hub repository is attached, checks whether engine files match the hub, runs a non-destructive sync dry-run, and provides spoke bootstrap snippets.
- **Security & Audit (`security`)**: Displays `.claude/settings.json` declarative allow/deny rules and the 4-stage lifecycle hook pipeline.

## Project Verification Commands (`CLAUDE.md`)

- **Typecheck**: `npm run typecheck --silent`
- **Unit Tests**: `node --test .harness/hooks/lib/runner-matcher.test.mjs`
- **Lint**: `npm run lint --silent`
