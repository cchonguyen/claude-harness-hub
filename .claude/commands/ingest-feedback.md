---
description: Parse external Gemini audit verdict into .spec/SYSTEM_SPEC.md and .spec/PROGRESS.md
argument-hint: [pasted Gemini verdict]
disable-model-invocation: true
---
Ingest the following external audit verdict from Gemini:
$ARGUMENTS

1. Apply any blocking architectural fixes to `.spec/SYSTEM_SPEC.md`.
2. Update task risk tags (`[UI / VISUAL]` or `[CORE / DATA]`) and prepend any required remediation slices to `.spec/PROGRESS.md`.
3. Output a 1-line receipt confirming the updates and state the next command to run (`/implement` or `/spec`).
