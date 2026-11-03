# Claude Harness Hub

Claude Harness Hub is the home of a **harness** for [Claude Code](https://www.anthropic.com/claude-code), Anthropic's AI coding assistant that runs in a terminal. A harness is a set of rules, guard scripts, and checks that keep an AI agent focused on the work you asked for, so it does not wander, skip verification, or edit files it should leave alone.

This repository is the source of truth for one such harness (currently engine version 3.2.0, see [`.harness-version`](.harness-version)). It also contains a small local dashboard for browsing the harness, running its checks, and editing its planning files.

## Who this is for

- Developers who use Claude Code on real projects and want a tested starting point for guardrails.
- Anyone curious how to build agent guardrails with plain Node.js scripts and Markdown files.

No API keys are needed to run anything in this repository.

## What is in here

| Path | What it holds |
| --- | --- |
| `CLAUDE.md`, `AGENTS.md` | Instructions that Claude Code and other agents read first. |
| `.claude/` | Subagent definitions, slash commands, and `settings.json` with allow and deny rules and hooks. |
| `.harness/` | Zero-dependency Node.js hooks and scripts: guards, checks, sync, and the PR scope check. |
| `.spec/` | Project state: the slice queue, architecture decisions, contracts, and handoff notes. |
| `server.ts`, `src/` | The dashboard: an Express server and a React front end. |
| `.github/workflows/` | Continuous integration: typecheck, lint, and unit tests on every pull request and push to `main`. |

## Quick start

You need [Node.js 22](https://nodejs.org) (the version CI uses) and Git.

```bash
git clone https://github.com/cchonguyen/claude-harness-hub.git
cd claude-harness-hub
npm install
npm run dev
```

Then open <http://127.0.0.1:3000> in your browser. The dashboard only listens on your own machine.

## Dashboard tabs

- **Overview (`overview`):** The "what's next" line, the current work mode, the session handoff summary, and the slice locks from `.spec/PROGRESS.md`.
- **Runner (`runner`):** Classifies a shell command against the harness rules, and runs the allow-listed checks (unit tests, typecheck, lint) with saved output.
- **Subagents (`agents`):** Lists the subagent definitions in `.claude/agents/` and the model each one uses.
- **Commands (`commands`):** Lists the slash commands in `.claude/commands/`.
- **Handoff (`handoff`):** Builds a bundle of the repo's state for an outside reviewer, with warnings when it looks stale.
- **Specs (`specs`):** Edits the registered planning and contract files, with a diff preview before saving.
- **Spoke sync (`spoke`):** Checks whether a project repo ("spoke") matches the engine files in this hub, and shows a sync dry run.
- **Security (`security`):** Shows the allow and deny rules in `.claude/settings.json` and the hook pipeline.

## Running the checks

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Syntax-checks the harness's `.mjs` files. It does not run the TypeScript compiler. |
| `npm run lint` | Runs the navigator check, which validates the spec index links and line budgets. It is not a code linter. |
| `npm test` | Runs the runner-matcher tests. |
| `node --test .harness/hooks/lib/*.test.mjs .harness/scripts/*.test.mjs .harness/scripts/lib/*.test.mjs` | Runs the full unit test suite. |
| `npm run build` | Builds the dashboard for production. |

## How the harness works

- **Hooks** are scripts that Claude Code runs before and after it uses a tool. For example, they block edits to protected files and log failed commands.
- **Slices** split work into small, named units in `.spec/PROGRESS.md`. A slice is only edited while it is marked in progress.
- **Subagents** are narrow helpers, such as a planner, an engineer, or an auditor, each with limited tools and a chosen model.
- **Referee trailers** are verification lines at the bottom of a git commit message. They record that the checks passed for that exact tree of files.
- **Spokes** are project repositories that copy the engine files from this hub. `.harness/scripts/hub-sync.mjs` handles the copy. See the "Spoke Connection Contract" in `.spec/SYSTEM_SPEC.md`.

Some notes mention Google Antigravity, Google AI Studio, or Gemini. Those are other AI tools the harness can hand a task to. They are optional, and the core harness does not depend on them.

## Architecture: Elephant, Falcon, Goldfish

The harness splits work across three tiers of agents. They differ in how much context each one carries and how long it lives. Routine bookkeeping goes to Node.js scripts, which cost no model tokens.

```text
                       TIER 2: THE FALCON (fa)
              [Main session coordinator, mid-tier model]
           Reads only the Context Atlas and dispatches work
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼ (on demand)             ▼ (one per slice)         ▼ (slice boundary)
  TIER 1: THE ELEPHANT      TIER 3: GOLDFISH SQUAD    THE NAVIGATOR ENGINE
     (el-architect)           (gf-coder / gf-*)         (navigator.mjs)
   Flagship-model subagent    Fast-model subagents      Node.js script
   Reads the repo, writes     Bounded to the slice's    Archives finished slices,
   the plan, then exits       Target files              enforces line budgets
```

- **Falcon (`fa`, main session):** Follows `AGENTS.md`. For small fixes it has a fast-path budget of 3 source reads, 1 search and a single-file edit of up to 25 lines (`fa_fast_path` in `.harness/config/thresholds.json`). It delegates anything larger.
- **Elephant (`el-architect`):** A subagent the Falcon starts on demand. It reads the repo, updates `.spec/`, and writes small slices with their target files to `.spec/PROGRESS.md`. It can only exit once `.harness/hooks/el-exit-gate.mjs` passes, and its context is discarded when it finishes.
- **Goldfish (`gf-*`):** Short-lived subagents. `gf-coder` builds one slice and may edit only that slice's target files. `gf-verifier` runs the quiet checks and the PR scope check. `gf-navigator` compresses `.spec/` files that go over their line caps. `gf-clerk` updates the handoff file and the Referee trailers.

The canonical agent definitions live in `.harness/agents/`. `hub-sync.mjs` compiles them into `.claude/agents/`, `.agents/` and `.harness/agents/runtime-payloads.json`.

### The Context Atlas

Each file the agents read has a numbered coordinate. A slice in `.spec/PROGRESS.md` lists the coordinates it needs, so an agent opens only those files and does not have to search the repo. `.spec/ATLAS.md` is the index.

| Sector | Files |
| --- | --- |
| `000` Compass | `AGENTS.md`, `CLAUDE.md` (a shim that loads `AGENTS.md`) |
| `100` Work logs | `.spec/PROGRESS.md` (110), `.spec/archive/HISTORY.md` (120), `.spec/BLACK_BOX.md` (130, only after a failure) |
| `200` Boundaries | `.spec/boundaries/locks.md` (210), `.spec/boundaries/do-not-build.md` (220) |
| `300` Contracts | `.harness/config/thresholds.json` (305), referee (310), circuit breaker (320), baton pass (330), review relay (340) |
| `400` System spec | `.spec/SYSTEM_SPEC.md` |

Every file in the Atlas has a soft line cap in `thresholds.json`. `npm run lint` reports any file that goes over its cap.

### Guardrails

- **Hook adapter (`.harness/hooks/adapter.mjs`):** Converts tool calls from Claude Code (`.claude/settings.json`) and Antigravity (`.agents/hooks.json`) into one format, so both tools run the same guard scripts.
- **Two-strike circuit breaker (`freeze-black-box.mjs`):** If `gf-coder` makes 2 exploratory searches or fails its tests twice, the script writes the diff and the error output to `.spec/BLACK_BOX.md`. It then stashes the changes as `black-box/<slice-id>` and hands the slice back to `el-architect`.
- **Finishing a slice (`finish-slice.mjs`, `navigator.mjs`, `referee.mjs`):** Checks that the changes stayed within the slice's scope and adds Referee trailers to the commit: the verdict, the tree, and a SHA-256 hash of the engine. It then moves the finished slice to `HISTORY.md` and marks the next pending slice as in progress, all in one commit.

### Slice commands

```bash
node .harness/scripts/hub-sync.mjs                 # regenerate agent definitions
node .harness/scripts/start-slice.mjs "Slice X.Y"  # anchor a new milestone's first slice
node .harness/scripts/finish-slice.mjs "<msg>"     # verify, commit, archive, advance
node .harness/scripts/navigator.mjs --check        # Atlas link and line-budget check
node .harness/scripts/pr-scope-check.mjs           # PR scope gate
```

## Status

This is an early-stage project, built by one developer working with AI agents. `.spec/OVERVIEW.md` lists what has been tested live and what has not. Known gaps:

- The `version` field in `package.json` still says 2.2.0, while the engine version is 3.2.0.
- The contract files for referee (310), circuit breaker (320), and review relay (340) are listed in the Atlas but do not exist yet. Only `.spec/contracts/baton-pass.md` is present.
- The repository has no `package-lock.json`, so `npm install` may resolve slightly different dependency versions over time.

## Security

The dashboard binds to `127.0.0.1` by default, has no login, and can edit a fixed list of planning files. Do not expose it to a network. The dashboard only runs allow-listed commands. The repository contains no secrets, and `.env` files are blocked by the Claude Code settings and by `.gitignore`. See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Contributing

Questions and bug reports are welcome as issues. Please open an issue before starting a large pull request so we can agree on the approach first.

## Glossary

- **Claude Code:** Anthropic's terminal assistant for software work.
- **Harness:** The rules, hooks, and checks that keep an agent on track.
- **Hub and spoke:** The hub is this repository. A spoke is a project repository that copies from it.
- **Hook:** A script that Claude Code runs at a fixed point, such as before a tool call.
- **Subagent:** A specialized helper that Claude Code can hand a task to.
- **Slice:** One small, self-contained unit of work.

## License

This project is released under the [MIT License](LICENSE).
