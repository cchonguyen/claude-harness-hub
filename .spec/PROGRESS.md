# Task Progress & Single-Slice Work Lock

> Rule: Mark only ONE task line at a time with the active work tag.

- [x] **Slice 1** `[CORE / DATA]`: Scaffold v2.0 Harness Engine & Templates — Target files: `.claude/`, `.harness/`, `.spec/`, `CLAUDE.md`
- [x] **Slice 1b** `[CORE / DATA]`: Restrict Vibe Mode green checkpoint to test/build passes — Target files: `.harness/hooks/lib/runner-matcher.mjs`, `.harness/hooks/lib/runner-matcher.test.mjs`, `.harness/hooks/post-tool-scrub.mjs`, `.claude/harness-rules.md`, `.spec/`
- [-] **Slice 2** `[CORE / DATA]`: Connect First Spoke & Validate Sync Engine — superseded by Slices 3.0 and 3.1 (ADR-008)

## Harness v3.0 "Manager Mode" (contract: `.spec/SYSTEM_SPEC.md` section 4)
- [x] **Slice 3.0** `[YELLOW][CORE / DATA]`: Live `/smoke-check` of v2.2 hooks in a real spoke before adding hook logic — Target files: `.spec/` — Verified via `cchonguyen/charliechonguyen.com#7` (smoke report, `--restore` results); live-session check folded into Slice 3.1 start
- [x] **Slice 3.1** `[YELLOW][CORE / DATA]`: hub-sync ownership classes, `.harness/managed.json`, v2.2 migration seeder, settings/gitignore/AGENTS.md merges, `init --target` — Target files: `.harness/scripts/hub-sync.mjs`, `.harness/scripts/lib/`, `.harness/templates/`, `.harness/hub.json`, `AGENTS.md`, `.spec/`
- [x] **Slice 3.2** `[YELLOW][CORE / DATA]`: CI gate: blocking `pr-scope-check.mjs` in spokes, Red tripwires, test rule, PR and main workflows with the `harness-main-red` tag and issue — Target files: `.harness/scripts/pr-scope-check.mjs`, `.harness/scripts/pr-scope-check.test.mjs`, `.harness/scripts/hub-sync.mjs`, `.harness/scripts/lib/sync-core.mjs`, `.harness/scripts/lib/sync-core.test.mjs`, `.harness/templates/`, `.github/workflows/`, `.spec/`
- [x] **Slice 3.3** `[YELLOW][CORE / DATA]`: Guard: `workMode` switch, spoke engine lock incl. `AGENTS.md` block, frozen colour tag, Bash write tripwire hook — Target files: `.harness/hooks/pre-tool-guard.mjs`, `.harness/hooks/bash-guard.mjs`, `.harness/hooks/post-tool-failure.mjs`, `.harness/hooks/lib/`, `.claude/settings.json`, `.spec/`
- [x] **Slice 3.4** `[YELLOW][CORE / DATA]`: Commands and relay: `/implement` auto-chain (max 3), `/quick-fix`, `/learn` candidates, session-start main-red and handoff surfacing, `Branch Owner` field, external rules update — Target files: `.claude/commands/`, `.claude/agents/`, `.claude/harness-rules.md`, `.harness/hooks/session-start.mjs`, `.harness/hooks/lib/`, `.harness/templates/`, `AGENTS.md`, `.spec/`
- [ ] **Slice 3.5** `[GREEN][CORE / DATA]`: runner-matcher additions, lockfile-free handoff diff, version 3.0.0, Overview update — Target files: `.harness/hooks/lib/runner-matcher.mjs`, `.harness/hooks/lib/runner-matcher.test.mjs`, `.harness/scripts/bundle-handoff.mjs`, `.harness-version`, `.spec/`
