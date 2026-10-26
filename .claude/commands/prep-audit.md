---
description: Package spec or git diff for zero-cost external Gemini review
argument-hint: [spec|diff]
allowed-tools: Bash(node *)
disable-model-invocation: true
---
Bundle status: !`node "${CLAUDE_PROJECT_DIR}/.harness/scripts/bundle-handoff.mjs" $ARGUMENTS`

Do NOT print `.spec/HANDOFF_PACKET.md` into the chat window (to save output tokens). Output ONLY the following action block:

---
Needed from you:
1. **Step 1 (macOS):** `.spec/HANDOFF_PACKET.md` is already copied to your clipboard. **(Cloud App):** Open `.spec/HANDOFF_PACKET.md` in the file explorer and click Copy.
2. **Step 2:** Switch to your Gemini tab, paste (`Cmd+V`), and press Enter (the `arch-auditor` or `code-reviewer` skill will trigger automatically from the header).
3. **Step 3:** Copy Gemini's verdict block and run `/ingest-feedback` followed by the pasted verdict.
