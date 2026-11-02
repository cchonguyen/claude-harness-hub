#!/usr/bin/env node
// Single-call slice finisher: verify, scope-check, mark the slice [x], update the handoff, and commit.
// Usage: node .harness/scripts/finish-slice.mjs --slice <id> --check "<quick check command>" --message "<commit subject>"
// Takes no bypass flags. Any failing step stops the run before anything is written or committed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PENDING_LINE = /^\s*-\s*\[ \]\s*\*\*Slice\s+([^*]+)\*\*/;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Flip one slice line from [ ] to [x] and drop any [IN_PROGRESS] tag. Returns null when the slice is not pending.
export function markSliceDone(progress, sliceId) {
  const target = new RegExp(`^(\\s*-\\s*)\\[ \\](\\s*\\*\\*Slice\\s+${escapeRegex(sliceId)}\\*\\*)`);
  const lines = progress.split('\n');
  const index = lines.findIndex((l) => target.test(l));
  if (index === -1) return null;
  lines[index] = lines[index]
    .replace(target, '$1[x]$2')
    .replace(/\s*\[IN_PROGRESS\]/, '');
  return lines.join('\n');
}

// Label of the first slice still pending after the given progress text, or null when none is left.
export function nextPendingSlice(progress) {
  const line = progress.split('\n').find((l) => PENDING_LINE.test(l));
  return line ? `Slice ${line.match(PENDING_LINE)[1].trim()}` : null;
}

// Rewrite the Active Slice and Verification Status lines of the handoff. Other fields stay as they are.
export function updateHandoff(handoff, { verification, next }) {
  const active = next ? `none (Next pending: ${next})` : 'none (all listed slices are done)';
  return handoff
    .split('\n')
    .map((l) => {
      if (/^- \*\*Active Slice:\*\*/.test(l)) return `- **Active Slice:** ${active}`;
      if (/^- \*\*Verification Status:\*\*/.test(l)) return `- **Verification Status:** ${verification}`;
      return l;
    })
    .join('\n');
}

const sh = (cmd, cwd) => spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function defaultScope(root) {
  const r = spawnSync('node', [path.join(root, '.harness/scripts/pr-scope-check.mjs')], { cwd: root, encoding: 'utf8' });
  return { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

// Run the whole finish. `runScope` is injectable so tests can stub the scope check.
export function finishSlice({ root, slice, check, message, runScope = defaultScope }) {
  const progressPath = path.join(root, '.spec', 'PROGRESS.md');
  const handoffPath = path.join(root, '.spec', 'SESSION_HANDOFF.md');
  const progress = fs.readFileSync(progressPath, 'utf8');

  const marked = markSliceDone(progress, slice);
  if (marked === null) return { ok: false, step: 'locate', reason: `Slice ${slice} is not pending in .spec/PROGRESS.md` };

  const run = sh(check, root);
  if (run.status !== 0) return { ok: false, step: 'verify', reason: `Quick check failed: ${check}\n${(run.stdout || '') + (run.stderr || '')}`.trim() };

  const scope = runScope(root);
  if (!scope.ok) return { ok: false, step: 'scope', reason: scope.output || 'Scope check failed' };

  const next = nextPendingSlice(marked);
  fs.writeFileSync(progressPath, marked);
  fs.writeFileSync(handoffPath, updateHandoff(fs.readFileSync(handoffPath, 'utf8'), { verification: `Verified: \`${check}\` exited 0.`, next }));

  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: root, stdio: 'ignore' });
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { ok: true, sha, next };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1];
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  const missing = ['slice', 'check', 'message'].filter((k) => !args[k]);
  if (missing.length) {
    console.error(`✗ Missing: ${missing.map((m) => `--${m}`).join(', ')}`);
    process.exit(2);
  }
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const result = finishSlice({ root, slice: args.slice, check: args.check, message: args.message });
  if (!result.ok) {
    console.error(`✗ Finish stopped at ${result.step}: ${result.reason}`);
    process.exit(1);
  }
  console.log(`✓ Slice ${args.slice} committed as ${result.sha}. Next pending: ${result.next ?? 'none'}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
