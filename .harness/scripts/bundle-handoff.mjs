#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const mode = (process.argv[2] || 'diff').toLowerCase();
const readSafe = (rel) => {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '_Not yet created_';
};

if (mode !== 'spec' && mode !== 'diff') {
  console.log(`✗ Unknown mode "${mode}". Use /prep-audit spec or /prep-audit diff.`);
  process.exit(0);
}

const overview = readSafe('.spec/OVERVIEW.md');
const spec = readSafe('.spec/SYSTEM_SPEC.md');
const progress = readSafe('.spec/PROGRESS.md');

let payload = '';
if (mode === 'spec') {
  payload = `@arch-auditor Please conduct an adversarial architecture and scope audit on the following specification. Surface blind spots, edge cases, over-engineering, and verify [UI / VISUAL] vs [CORE / DATA] risk tags.\n\n# OVERVIEW\n${overview}\n\n# SYSTEM SPEC\n${spec}\n\n# PROGRESS & TASKS\n${progress}`;
} else {
  let diff = '';
  try {
    execSync('git add -N .', { cwd: root, stdio: 'ignore' });
    diff = execSync('git diff HEAD', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 10 * 1024 * 1024 });
  } catch {
    try {
      diff = execSync('git diff', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 10 * 1024 * 1024 });
    } catch {
      diff = '_Unable to compute git diff (repository has no commits yet)_';
    }
  }
  payload = `@code-reviewer Please audit this implementation diff against our System Spec and active task slice. Identify bugs, security flaws, scope breaches, or regressions.\n\n# SYSTEM SPEC\n${spec}\n\n# ACTIVE PROGRESS\n${progress}\n\n# GIT DIFF\n\`\`\`diff\n${diff}\n\`\`\``;
}

const outPath = path.join(root, '.spec', 'HANDOFF_PACKET.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, payload, 'utf8');

if (os.platform() === 'darwin') {
  const copied = spawnSync('pbcopy', { input: payload });
  if (copied.status === 0) {
    console.log('✓ Packet written to .spec/HANDOFF_PACKET.md and auto-copied to macOS Clipboard.');
  } else {
    console.log('✓ Packet written to .spec/HANDOFF_PACKET.md (Clipboard unavailable; open file to copy).');
  }
} else {
  console.log('✓ Non-macOS / Cloud environment: Packet saved to .spec/HANDOFF_PACKET.md (Open file in sidebar to copy without burning chat tokens).');
}
