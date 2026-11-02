---
description: Generate system architecture contracts and risk-tagged task slices (<5 files per slice)
argument-hint: [optional: sonnet|opus]
allowed-tools: Bash(node *)
---
Tier gate status: !`node "${CLAUDE_PROJECT_DIR:-.}/.harness/scripts/evaluate-upshift.mjs" spec $ARGUMENTS`

1. If the tier gate status above begins with `⚠ UPSHIFT_THRESHOLD_REACHED`, STOP immediately without spawning any subagent and output ONLY the `Needed from you:` block printed above.
2. Otherwise, use the subagent specified by the tier gate (`architect` on Sonnet by default, or `architect-opus` ONLY when `/spec opus` was explicitly passed) to translate `.spec/SYSTEM_SPEC.md` into schemas, file boundaries, and atomic (<5 target files) risk-tagged tasks in `.spec/PROGRESS.md`.
3. Run `node "${CLAUDE_PROJECT_DIR:-.}/.harness/scripts/bundle-handoff.mjs" spec` to prepare `.spec/HANDOFF_PACKET.md`.
4. Do NOT print the packet in chat. Conclude with the `Needed from you:` steps for Gemini's `arch-auditor` skill.
