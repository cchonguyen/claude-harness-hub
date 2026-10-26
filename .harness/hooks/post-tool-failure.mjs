#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateFile = path.join(root, '.spec', '.strike-counter.json');

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

const cmd = event.tool_input?.command || '';
const isTestOrBuild = /\b(vitest|jest|tsc|eslint|typecheck)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|typecheck)\b/i.test(cmd);
if (!isTestOrBuild) process.exit(0);

const sessionId = event.session_id || 'default';
const errText = String(event.error || event.tool_response?.stderr || '');
// Fingerprint the actual error lines, not the npm banner, and mask numbers (durations, line:col)
const allLines = errText.split('\n').map((l) => l.trim()).filter(Boolean);
const errorLines = allLines.filter((l) => /error|fail|✗|×|expected|cannot|not found|exception/i.test(l));
const errorSig = (errorLines.length ? errorLines.slice(0, 6) : allLines.slice(-6))
  .join(' ')
  .replace(/\d+/g, '#')
  .replace(/\s+/g, ' ')
  .slice(0, 240);

let allState = {};
if (fs.existsSync(stateFile)) {
  try { allState = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
}

const prev = allState[sessionId] || { strikes: 0, lastSig: '' };
const strikes = prev.lastSig === errorSig ? prev.strikes + 1 : 1;
allState[sessionId] = { strikes, lastSig: errorSig, updatedAt: new Date().toISOString() };

fs.mkdirSync(path.join(root, '.spec'), { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify(allState, null, 2));

if (strikes >= 2) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUseFailure',
      additionalContext: 'CIRCUIT BREAKER TRIGGERED (2 Consecutive Identical Test/Build Failures): Stop guessing immediately. Restore ONLY the active slice target files (git checkout HEAD -- <target-files>), and output a "Needed from you:" block offering /prep-audit diff.'
    }
  }));
}
process.exit(0);
