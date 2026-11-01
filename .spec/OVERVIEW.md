# Project Overview (Owner's Manual)

## What This App Does
- Centralized Token-Optimized Claude Code Agent Harness (`claude-harness-hub`).

## Active External Services & Keys
- None required (Zero-API-Cost Gemini Web Clipboard Bridge).

## Current Build Status
- **Live & Verified:** Core v2.0 Harness Scaffolding; Vibe Mode (edit freely when no slice is active, auto-checkpoint at session start, "last known green" restore), Python test/lint support, hub sync from an attached sibling repo
- **Written, not yet tested live:** Unified external co-development protocol. When Claude Code hits its usage limit, Google Antigravity (terminal-capable) or Google AI Studio (web-only) takes one bounded task through GitHub. The canonical contract is `.spec/EXTERNAL_AGENT_RULES.md`. `.spec/AI_STUDIO_RULES.md` is an alias for it. All platforms share the handoff format in `.spec/SESSION_HANDOFF.md`, and Claude ingests external branches only after it verifies them.
- **Live & Verified:** Operator dashboard (React app, `npm run dev`) showing harness commands, agents, specs, and copy-paste prompts for Claude and Google AI Studio.
- **In Progress:** None
- **Up Next:** Connect first spoke project
