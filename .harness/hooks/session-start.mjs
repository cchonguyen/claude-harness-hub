#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const handoffPath = path.join(root, '.spec', 'SESSION_HANDOFF.md');

let contextMsg = `✓ Harness v2.0 active (Node ${process.version}).`;
if (fs.existsSync(handoffPath)) {
  const handoff = fs.readFileSync(handoffPath, 'utf8').trim();
  if (handoff) {
    contextMsg += `\n\n[AUTO-INJECTED SESSION HANDOFF]:\n${handoff}`;
  }
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: contextMsg
  }
}));
