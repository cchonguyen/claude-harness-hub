#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateFile = path.join(root, '.spec', '.strike-counter.json');

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

const sessionId = event.session_id || 'default';
const cmd = event.tool_input?.command || '';
// Only real test/build runners, so `cat test/x` or `git commit -m "build"` are never touched
const isTestOrBuild = /\b(vitest|jest|tsc|eslint|typecheck)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|typecheck)\b/i.test(cmd);

// 1. Reset strike counter for this session when a test/build command succeeds
if (isTestOrBuild && fs.existsSync(stateFile)) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (state[sessionId]?.strikes > 0) {
      state[sessionId] = { strikes: 0, lastSig: '' };
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    }
  } catch {}
}

// 2. Scrub overly verbose passing stdout (>40 lines) to save context tokens
const response = event.tool_response;
const stdout = typeof response?.stdout === 'string' ? response.stdout : '';
const lines = stdout.split('\n');
if (isTestOrBuild && lines.length > 40) {
  const scrubbed = [
    `[HARNESS LOG SCRUBBER: Truncated ${lines.length - 20} passing log lines to save tokens]`,
    ...lines.slice(-20)
  ].join('\n');
  // Must keep the Bash output shape ({stdout, stderr, interrupted, isImage}); a bare string is ignored
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: { ...response, stdout: scrubbed }
    }
  }));
}
process.exit(0);
