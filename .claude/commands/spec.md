---
description: Generate system architecture contracts and risk-tagged task slices
allowed-tools: Bash(node *)
---
1. Use the `architect` subagent to translate `.spec/SYSTEM_SPEC.md` into schemas, file boundaries, and risk-tagged tasks in `.spec/PROGRESS.md`.
2. Run `node "${CLAUDE_PROJECT_DIR}/.harness/scripts/bundle-handoff.mjs" spec` to prepare `.spec/HANDOFF_PACKET.md`.
3. Do NOT print the packet in chat. Conclude with the `Needed from you:` steps for Gemini's `arch-auditor` skill.
