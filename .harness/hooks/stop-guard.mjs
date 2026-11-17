#!/usr/bin/env node
// Stop hook (stall prevention, slice 10.5, narrowed in slice 19.1). Blocks ending a turn only while the
// working-tree .spec/PROGRESS.md has an [IN_PROGRESS] slice line (the slice in progress on this branch).
// Pending `- [ ]` lines alone never block, so unmerged plans do not stall every thread. Escapes:
//   - CLAUDE_WAKE_SCHEDULED=1       a wake-up is scheduled for this session (no harness file records this yet)
//   - CLAUDE_PR_SUBSCRIBED=1        this session is subscribed to a PR (no harness marker file exists yet)
// Output: {"decision":"block","reason":"..."} on stdout when blocking; nothing and exit 0 when allowing.
// Never throws. Malformed stdin fails open (allows stop). A repeat stop (stop_hook_active) is allowed,
// so the hook blocks at most once per stop attempt and cannot loop.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRoot } from './lib/vibe.mjs';

const IN_PROGRESS_LINE = /^\s*-\s*\[[ x]\].*\[IN_PROGRESS\]/m;
const SLICE_ID = /\*\*Slice\s+([^:*]+):/;

// True when a slice line in the progress text is marked [IN_PROGRESS]. Pending `- [ ]` lines do not count.
export function hasInProgressSlice(progressText = '') {
  return IN_PROGRESS_LINE.test(String(progressText));
}

// The id of the first [IN_PROGRESS] slice line, or '' when there is none.
export function inProgressSliceId(progressText = '') {
  const line = String(progressText).split('\n').find((text) => IN_PROGRESS_LINE.test(text));
  const match = line ? SLICE_ID.exec(line) : null;
  return match ? match[1].trim() : '';
}

export function escapeReason(env = {}) {
  if (String(env.CLAUDE_WAKE_SCHEDULED || '') === '1') return 'wake scheduled';
  if (String(env.CLAUDE_PR_SUBSCRIBED || '') === '1') return 'PR subscribed';
  return '';
}

// Returns a block reason string, or '' to allow the stop.
export function stopDecision({ root, env = {}, payload = {} } = {}) {
  try {
    if (payload && payload.stop_hook_active === true) return '';
    const progressPath = path.join(String(root || ''), '.spec', 'PROGRESS.md');
    if (!fs.existsSync(progressPath)) return '';
    const progress = fs.readFileSync(progressPath, 'utf8');
    if (!hasInProgressSlice(progress)) return '';
    if (escapeReason(env)) return '';
    const id = inProgressSliceId(progress) || '(unnamed)';
    return `Slice ${id} is still [IN_PROGRESS] in .spec/PROGRESS.md. Finish it with finish-slice.mjs or schedule a wake-up before stopping.`;
  } catch {
    return '';
  }
}

const main = () => {
  let payload = null;
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return; }
  if (!payload || typeof payload !== 'object') return;
  const root = (typeof payload.cwd === 'string' && payload.cwd) || process.env.CLAUDE_PROJECT_DIR || resolveRoot();
  const reason = stopDecision({ root, env: process.env, payload });
  if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
};

// Run only when executed directly, so tests can import stopDecision without touching stdin.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  try { main(); } catch {
    // A Stop hook must never break the turn. Allow the stop on any failure.
  }
  process.exit(0);
}
