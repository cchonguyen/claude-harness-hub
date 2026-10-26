# System Specification & Contracts

## 1. Core Scope & MVP Boundaries
- Provide deterministic hooks, model-routed subagents, and zero-cost Gemini audit handoffs.

## 2. Strictly Out of Scope ("Do NOT Build" List)
- No paid external API calls inside hooks.
- No external npm dependencies inside `.harness/`.
- No symlinks outside the repository root.

## 3. Data Models & Module Boundaries
- `.claude/`: Subagents, commands, settings, and `harness-rules.md`.
- `.harness/`: Zero-dependency Node.js hooks and scripts.
- `.spec/`: Project state and specification artifacts.
