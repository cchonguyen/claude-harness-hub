#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { modeOf, readCheckpoints, ensureBaseline, diffSince } from './lib/vibe.mjs';
import {
  agentsBlock, colourOf, isEngineLocked, isEnginePath, isHubOrigin, nextContent,
} from './lib/guard-rules.mjs';
import { appendBatchEvent } from '../scripts/status-batch.mjs';
import { clearUpshiftAuth, verifyUpshiftAuth } from '../scripts/evaluate-upshift.mjs';

const gitIn = (cwd, args, env = {}) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, ...env } }).trim();
const gitRoot = () => { try { return gitIn(process.cwd(), ['rev-parse', '--show-toplevel']); } catch { return ''; } };

// Claude's Bash shell has no CLAUDE_PROJECT_DIR, so `--restore` falls back to the git top level
let root = process.env.CLAUDE_PROJECT_DIR || gitRoot() || process.cwd();
let progressPath = path.join(root, '.spec', 'PROGRESS.md');
let checkpointFile = path.join(root, '.spec', '.slice-checkpoint');
// The git repo that owns a file, found from the file's own folder (not from the session's first repo)
function repoRootOf(absFile) {
  let dir = path.dirname(absFile);
  while (!fs.existsSync(dir) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  try { return gitIn(dir, ['rev-parse', '--show-toplevel']); } catch { return ''; }
}
function useRepo(dir) {
  root = dir;
  progressPath = path.join(dir, '.spec', 'PROGRESS.md');
  checkpointFile = path.join(dir, '.spec', '.slice-checkpoint');
}
const CHECKPOINT_REF = 'refs/harness/slice-checkpoint';
const ACTIVE_TASK = /^\s*-\s*\[.\].*\[IN_PROGRESS\]/;
const git = (args, env) => gitIn(root, args, env);

const activeTargets = (line) => {
  const match = line?.match(/Target files:\s*(.+)$/i);
  if (!match) return [];
  return match[1].replace(/[`*]/g, '').split(',').map((s) => s.trim().replace(/^\.\//, '')).filter(Boolean);
};

// Snapshot the whole working tree (tracked + untracked, minus .gitignore) through a throwaway
// index, so the real index and files on disk are untouched. A hidden ref keeps it safe from gc.
function captureCheckpoint() {
  const tmpIndex = path.join(os.tmpdir(), `harness-index-${process.pid}`);
  const env = { GIT_INDEX_FILE: tmpIndex };
  try {
    let head = '';
    try { head = git(['rev-parse', '--verify', 'HEAD']); } catch {}
    if (head) git(['read-tree', head], env);
    git(['add', '-A', '--', '.'], env);
    const tree = git(['write-tree'], env);
    const identity = { GIT_AUTHOR_NAME: 'claude-harness', GIT_AUTHOR_EMAIL: 'harness@localhost', GIT_COMMITTER_NAME: 'claude-harness', GIT_COMMITTER_EMAIL: 'harness@localhost' };
    const commit = git(['commit-tree', tree, ...(head ? ['-p', head] : []), '-m', 'harness: slice-start checkpoint'], identity);
    git(['update-ref', CHECKPOINT_REF, commit]);
    fs.mkdirSync(path.dirname(checkpointFile), { recursive: true });
    fs.writeFileSync(checkpointFile, commit, 'utf8');
  } catch {
    // Not a git repo, or git missing: the slice proceeds without a checkpoint
  } finally {
    fs.rmSync(tmpIndex, { force: true });
  }
}

// Vibe Mode restore: back to the last known green checkpoint. With no green yet, only list what changed.
function restoreVibe() {
  const all = readCheckpoints(root);
  const sid = process.env.CLAUDE_SESSION_ID;
  const entry = all[sid] || Object.values(all).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  if (!entry?.sha) {
    console.log('✗ Nothing restored: no Vibe checkpoint exists for this project yet.');
    process.exit(1);
  }
  const { restore, remove } = diffSince(root, entry.sha);
  if (!entry.green) {
    const all2 = [...restore, ...remove];
    console.log(`⚠ Nothing has passed yet this session, so nothing was restored. ${all2.length} file(s) changed since the session baseline${all2.length ? `: ${all2.join(', ')}` : ''}. Offer the user a restore in the "Needed from you:" block.`);
    process.exit(0);
  }
  if (restore.length) git(['restore', `--source=${entry.sha}`, '--worktree', '--', ...restore]);
  for (const file of remove) fs.rmSync(path.join(root, file), { force: true });
  console.log(`✓ Restored ${restore.length} file(s) to the last green checkpoint${remove.length ? `; removed ${remove.length} file(s) created since (${remove.join(', ')})` : ''}.`);
  process.exit(0);
}

// `node .harness/hooks/pre-tool-guard.mjs --restore`: put the active slice's target files back to
// the slice-start checkpoint. Files the slice created are removed; nothing else is touched.
if (process.argv[2] === '--restore') {
  const lines = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8').split('\n') : [];
  if (!lines.some((line) => ACTIVE_TASK.test(line))) restoreVibe();
  const targets = activeTargets(lines.find((line) => ACTIVE_TASK.test(line)));
  if (!targets.length) {
    console.log('✗ Nothing restored: no [IN_PROGRESS] task with "Target files:" in .spec/PROGRESS.md.');
    process.exit(1);
  }
  let source = fs.existsSync(checkpointFile) ? fs.readFileSync(checkpointFile, 'utf8').trim() : '';
  try { if (source) git(['cat-file', '-e', `${source}^{commit}`]); } catch { source = ''; }
  const hasCheckpoint = Boolean(source);
  const label = hasCheckpoint ? 'slice-start checkpoint' : 'last commit (no checkpoint found; new files left in place)';
  source ||= 'HEAD';

  const listAt = (rel) => {
    let inSource = [];
    try { inSource = git(['ls-tree', '-r', '--name-only', source, '--', rel]).split('\n').filter(Boolean); } catch {}
    let onDisk = [];
    try { onDisk = git(['ls-files', '--cached', '--others', '--exclude-standard', '--', rel]).split('\n').filter(Boolean); } catch {}
    return { inSource, onDisk };
  };
  const restored = [];
  const removed = [];
  for (const rel of targets) {
    const { inSource, onDisk } = listAt(rel);
    if (inSource.length) {
      git(['restore', `--source=${source}`, '--worktree', '--', ...inSource]);
      restored.push(...inSource);
    }
    // Without a checkpoint we can't tell slice-created files from older untracked work, so keep them
    if (!hasCheckpoint) continue;
    for (const file of onDisk.filter((f) => !inSource.includes(f))) {
      fs.rmSync(path.join(root, file), { force: true });
      removed.push(file);
    }
  }
  const msg = `✓ Restored ${restored.length} file(s) to the ${label}${removed.length ? `; removed ${removed.length} file(s) the slice created (${removed.join(', ')})` : ''}.`;
  appendBatchEvent(root, { event: 'slice_restore', summary: msg });
  console.log(msg);
  process.exit(0);
}

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

// Guard 0: Block silent subagent upshifts (engineer-sonnet / architect-opus require explicit operator authorization)
if (event.tool_name === 'Agent' || event.tool_name === 'Task') {
  const subagentType = String(event.tool_input?.subagent_type || event.tool_input?.name || '').trim();
  const authCheck = verifyUpshiftAuth(root, subagentType);
  if (!authCheck.allowed) {
    console.error(authCheck.reason);
    process.exit(2);
  }
  process.exit(0);
}

const targetFile = event.tool_input?.file_path || event.tool_input?.notebook_path || '';
if (!targetFile) process.exit(0);

// Resolve symlinks (e.g. macOS /var -> /private/var) on the deepest existing ancestor so git's realpath matches targetFile
function canonicalPath(p) {
  const abs = path.resolve(p);
  let cur = abs;
  const tail = [];
  while (!fs.existsSync(cur) && path.dirname(cur) !== cur) {
    tail.unshift(path.basename(cur));
    cur = path.dirname(cur);
  }
  try { cur = fs.realpathSync(cur); } catch {}
  return path.join(cur, ...tail);
}

// A file is governed by the git repo it lives in, so a session with two attached repos checks each one's rules
const fileRepo = repoRootOf(path.resolve(root, targetFile));
if (fileRepo) useRepo(canonicalPath(fileRepo));
else useRepo(canonicalPath(root));

const absTarget = canonicalPath(path.resolve(root, targetFile));
const relTarget = path.relative(root, absTarget).replace(/\\/g, '/');

// Block direct model Write/Edit to .spec/.upshift-auth.json (only evaluate-upshift.mjs may write it)
if (relTarget === '.spec/.upshift-auth.json') {
  console.error('UPSHIFT LOCK VIOLATION: .spec/.upshift-auth.json is managed exclusively by operator slash-command flags (/implement sonnet, /spec opus).');
  process.exit(2);
}

// 0. Files outside any project (e.g. ~/.claude memory) are not governed by the slice lock
if (relTarget.startsWith('../') || path.isAbsolute(relTarget)) process.exit(0);

// Vibe Mode (0 active slices): edits are free, but make sure a baseline exists before the first change
if (modeOf(root) === 'vibe') ensureBaseline(root, event.session_id || 'default');

// 1. If editing .spec/PROGRESS.md itself, verify incoming text doesn't mark >1 task line as [IN_PROGRESS]
if (relTarget === '.spec/PROGRESS.md') {
  const currentContent = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8') : '';
  const incoming = nextContent(currentContent, event.tool_name, event.tool_input || {});
  const activeTaskLines = incoming.split('\n').filter((line) => ACTIVE_TASK.test(line));

  if (activeTaskLines.length > 1) {
    console.error('WORK LOCK VIOLATION: Cannot mark more than 1 task line as [IN_PROGRESS] in .spec/PROGRESS.md.');
    process.exit(2);
  }
  // A newly activated slice (none active before, or a different line now) gets a fresh checkpoint
  // Slices are identified by "**Slice N**", so rewording the active line mid-slice keeps its checkpoint
  const sliceId = (line) => line?.match(/\*\*Slice\s+([^*]+)\*\*/)?.[1].trim() ?? line?.trim();
  const previousActive = currentContent.split('\n').find((line) => ACTIVE_TASK.test(line));
  // Frozen colour (4.C.1): the colour tag of a slice is set at /spec and cannot change while the slice is active
  const nowActive = activeTaskLines[0];
  if (activeTaskLines.length === 1 && previousActive && sliceId(nowActive) === sliceId(previousActive)
    && colourOf(nowActive) !== colourOf(previousActive)) {
    console.error(`COLOUR LOCK: The colour tag on the active slice is frozen at /spec. Keep ${colourOf(previousActive) || 'its current tag'}; only the architect changes it.`);
    process.exit(2);
  }
  const prevId = sliceId(previousActive);
  const nextId = sliceId(activeTaskLines[0]);
  if (previousActive && prevId !== nextId) {
    const completedNow = incoming.split('\n').some((l) => /^\s*-\s*\[x\]/i.test(l) && sliceId(l) === prevId);
    if (completedNow) {
      clearUpshiftAuth(root);
      appendBatchEvent(root, {
        event: 'slice_complete',
        slice: `Slice ${prevId}`,
        summary: `Completed Slice ${prevId}`
      });
    }
  }
  if (activeTaskLines.length === 1 && nextId !== prevId) {
    captureCheckpoint();
    appendBatchEvent(root, {
      event: 'slice_start',
      slice: `Slice ${nextId}`,
      summary: `Locked and started Slice ${nextId} (checkpoint saved)`
    });
  }
  process.exit(0);
}

// 2. Engine lock (SYSTEM_SPEC 4.A.3). In a spoke the hub owns these files in every mode. The hub itself is the source,
// so it is not locked. Hub detection uses the origin URL only: a folder name or hub.json can be changed by an agent.
let origin = '';
try { origin = git(['remote', 'get-url', 'origin']); } catch {}
const isHubRepo = isHubOrigin(origin);
if (!isHubRepo && isEngineLocked(relTarget)) {
  console.error(`ENGINE LOCK: ${relTarget} is owned by the harness hub. Change it in claude-harness-hub, then run node .harness/scripts/hub-sync.mjs pull.`);
  process.exit(2);
}
// The harness block in AGENTS.md is hub-owned. The rest of AGENTS.md is the spoke's.
if (!isHubRepo && relTarget === 'AGENTS.md') {
  const current = fs.existsSync(absTarget) ? fs.readFileSync(absTarget, 'utf8') : '';
  const next = nextContent(current, event.tool_name, event.tool_input || {});
  if (agentsBlock(current) !== agentsBlock(next)) {
    console.error('ENGINE LOCK: The harness block in AGENTS.md is hub-owned. Edit the text outside the markers, or change the block in claude-harness-hub.');
    process.exit(2);
  }
}

// Always permitted: spec files, CLAUDE.md, and the spoke's own rules file
if (relTarget.startsWith('.spec/') || relTarget === 'CLAUDE.md' || relTarget === '.claude/project-rules.md') {
  process.exit(0);
}
if (isHubRepo && isEnginePath(relTarget) && ['vibe', 'slice'].includes(modeOf(root))) {
  process.exit(0);
}

// Manager Mode (4.A.1): no active slice means no source edits until a task is planned
if (modeOf(root) === 'locked') {
  console.error('PLAN LOCK: No task is marked [IN_PROGRESS] in .spec/PROGRESS.md. Run /triage or /spec first.');
  process.exit(2);
}

// 3. For source code edits, enforce that at most 1 task is [IN_PROGRESS] and check declared target files if specified
if (fs.existsSync(progressPath)) {
  const lines = fs.readFileSync(progressPath, 'utf8').split('\n');
  const activeLines = lines.filter((line) => ACTIVE_TASK.test(line));

  if (activeLines.length > 1) {
    console.error('WORK LOCK VIOLATION: Multiple tasks are marked [IN_PROGRESS] in .spec/PROGRESS.md. Keep only 1 active slice (or clear them all for Vibe Mode), then retry.');
    process.exit(2);
  }

  if (activeLines.length === 1) {
    const allowedList = activeTargets(activeLines[0]);
    // Exact file match, or the file sits inside a listed folder (entry ending in "/")
    const isAllowed = (allowed) =>
      relTarget === allowed || relTarget.startsWith(allowed.endsWith('/') ? allowed : `${allowed}/`);
    if (allowedList.length > 0 && !allowedList.some(isAllowed)) {
      console.error(`SCOPE LOCK BLOCK: "${relTarget}" is not listed in the active slice's Target files (${allowedList.join(', ')}). Update .spec/PROGRESS.md first if this file is required.`);
      process.exit(2);
    }
  }
}
process.exit(0);
