---
description: Package spec or git diff for zero-cost external Gemini review
argument-hint: [spec|audit|arch|overview|diff]
allowed-tools: Bash(node *)
disable-model-invocation: true
---
Bundle status: !`node "${CLAUDE_PROJECT_DIR}/.harness/scripts/bundle-handoff.mjs" $ARGUMENTS`

Do NOT print `.spec/HANDOFF_PACKET.md` into the chat window (to save output tokens). Output the 1-line bundle status above exactly as printed, keeping any `⚠ Warning`. If it carries the stub warning, fill `.spec/SYSTEM_SPEC.md` (or link the real spec docs from it) and rerun before sending the packet. Then output ONLY the following action block:

---
Needed from you:
1. **Step 1 (macOS):** `.spec/HANDOFF_PACKET.md` is already copied to your clipboard. **(Cloud App):** Open `.spec/HANDOFF_PACKET.md` in the file explorer and click Copy.
2. **Step 2:** Switch to your Gemini tab, paste (`Cmd+V`), and press Enter (the `arch-auditor` or `code-reviewer` skill will trigger automatically from the header).
3. **Step 3:** Copy Gemini's verdict block and run `/ingest-feedback` followed by the pasted verdict.
