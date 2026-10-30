#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { modeOf, readCheckpoints, ensureBaseline, diffSince } from './lib/vibe.mjs';

const gitIn = (cwd, args, env = {}) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, ...env } }).trim();
const gitRoot = () => { try { return gitIn(process.cwd(), ['rev-parse', '--show-toplevel']); } catch { return ''; } };

// Claude's Bash shell has no CLAUDE_PROJECT_DIR, so `--restore` falls back to the git top level
const root = process.env.CLAUDE_PROJECT_DIR || gitRoot() || process.cwd();
const progressPath = path.join(root, '.spec', 'PROGRESS.md');
const checkpointFile = path.join(root, '.spec', '.slice-checkpoint');
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
  console.log(`✓ Restored ${restored.length} file(s) to the ${label}${removed.length ? `; removed ${removed.length} file(s) the slice created (${removed.join(', ')})` : ''}.`);
  process.exit(0);
}

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

const targetFile = event.tool_input?.file_path || event.tool_input?.notebook_path || '';
if (!targetFile) process.exit(0);

const absTarget = path.resolve(root, targetFile);
const relTarget = path.relative(root, absTarget).replace(/\\/g, '/');

// 0. Files outside the project (e.g. ~/.claude memory) are not governed by the slice lock
if (relTarget.startsWith('../') || path.isAbsolute(relTarget)) process.exit(0);

// Vibe Mode (0 active slices): edits are free, but make sure a baseline exists before the first change
if (modeOf(root) === 'vibe') ensureBaseline(root, event.session_id || 'default');

// 1. If editing .spec/PROGRESS.md itself, verify incoming text doesn't mark >1 task line as [IN_PROGRESS]
if (relTarget === '.spec/PROGRESS.md') {
  const currentContent = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8') : '';
  let nextContent = currentContent;
  const input = event.tool_input || {};
  if (event.tool_name === 'Write') {
    nextContent = input.content || '';
  } else if (event.tool_name === 'Edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    // split/join avoids String.replace treating "$&" etc. in new_string as patterns
    nextContent = input.replace_all
      ? currentContent.split(input.old_string).join(input.new_string)
      : currentContent.replace(input.old_string, () => input.new_string);
  }
  const activeTaskLines = nextContent.split('\n').filter((line) => ACTIVE_TASK.test(line));

  if (activeTaskLines.length > 1) {
    console.error('WORK LOCK VIOLATION: Cannot mark more than 1 task line as [IN_PROGRESS] in .spec/PROGRESS.md.');
    process.exit(2);
  }
  // A newly activated slice (none active before, or a different line now) gets a fresh checkpoint
  // Slices are identified by "**Slice N**", so rewording the active line mid-slice keeps its checkpoint
  const sliceId = (line) => line?.match(/\*\*Slice\s+([^*]+)\*\*/)?.[1].trim() ?? line?.trim();
  const previousActive = currentContent.split('\n').find((line) => ACTIVE_TASK.test(line));
  if (activeTaskLines.length === 1 && sliceId(activeTaskLines[0]) !== sliceId(previousActive)) {
    captureCheckpoint();
  }
  process.exit(0);
}

// 2. Always permit edits to .spec/ or CLAUDE.md. Engine files (.claude/, .harness/, .harness-version) are
// editable in the hub repo itself; in a spoke, sync owns them, so a slice must list them in Target files:
const isEnginePath = relTarget.startsWith('.claude/') || relTarget.startsWith('.harness/') || relTarget === '.harness-version';
const isHubRepo = (() => {
  let repo = 'claude-harness-hub';
  try { repo = JSON.parse(fs.readFileSync(path.join(root, '.harness', 'hub.json'), 'utf8')).repo || repo; } catch {}
  let origin = '';
  try { origin = git(['remote', 'get-url', 'origin']); } catch {}
  return path.basename(root) === repo || new RegExp(`[/:]${repo}(\\.git)?$`).test(origin);
})();
if (relTarget.startsWith('.spec/') || relTarget === 'CLAUDE.md' || (isEnginePath && (modeOf(root) === 'vibe' || (isHubRepo && modeOf(root) === 'slice')))) {
  process.exit(0);
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
