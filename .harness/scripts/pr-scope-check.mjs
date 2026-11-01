#!/usr/bin/env node
// Scope, tripwire, and test check for a pull request.
// Usage: node .harness/scripts/pr-scope-check.mjs [base=origin/main] [head=HEAD] [--strict]
//   Hub (default): advisory. Prints problems and always exits 0.
//   Spoke (--strict): blocking. Exits 1 on any problem so the PR check shows red.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ACTIVE_TASK = /^\s*-\s*\[.\].*\[IN_PROGRESS\]/;
const SLICE_TYPE = /\[(UI \/ VISUAL|CORE \/ DATA)\]/;
const TEST_FILE = /(\.test\.|\.spec\.)[^/]*$|(^|\/)test_[^/]*\.py$|_test\.(py|go)$/;
const ASSERTION = /expect\(|assert|should|toBe|toEqual|raises|t\.Error|t\.Fatal/;
const SKIP_MARK = /\.skip\(|\.only\(|\bxit\(|\bxdescribe\(|@pytest\.mark\.skip|t\.Skip\(|t\.skip\(/;
const MANIFEST = /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|requirements[^/]*\.txt|pyproject\.toml|uv\.lock|go\.(mod|sum)|Cargo\.(toml|lock))$/;
// Spoke-owned engine-adjacent files that a spoke may change even though they sit in an engine folder
const SPOKE_OWNED = new Set(['.claude/project-rules.md', '.claude/settings.spoke.json']);

// Red tripwires: any match makes the slice Red, whatever colour the slice line carries
export const TRIPWIRES = [
  { name: 'dependency manifest or lockfile', test: (f) => MANIFEST.test(f) },
  { name: 'migrations folder', test: (f) => /(^|\/)migrations\//.test(f) },
  { name: 'schema file', test: (f) => /schema/i.test(f) },
  { name: 'auth file', test: (f) => /(^|[/._-])auth([/._-]|$)/i.test(f) },
  { name: 'env file', test: (f) => /(^|\/)\.env[^/]*$/.test(f) },
  { name: 'AGENTS.md', test: (f) => f === 'AGENTS.md' },
  { name: 'CI workflow', test: (f) => f.startsWith('.github/workflows/') },
];

export const isTestFile = (file) => TEST_FILE.test(file);
export const isEngineFile = (file) =>
  !SPOKE_OWNED.has(file) && (file.startsWith('.claude/') || file.startsWith('.harness/') || file === '.harness-version');

// `git diff --name-status -M` output -> changed paths and deleted paths (a rename deletes its old path)
export function parseNameStatus(text) {
  const changed = [];
  const deleted = [];
  for (const line of text.split('\n').filter(Boolean)) {
    const [status, ...paths] = line.split('\t');
    const letter = status[0];
    if (letter === 'D') deleted.push(paths[0]);
    else if (letter === 'R') { deleted.push(paths[0]); changed.push(paths[1]); }
    else changed.push(paths[paths.length - 1]);
  }
  return { changed: [...new Set(changed)], deleted };
}

// `git diff -U0` output -> per-file lists of added and removed content lines
export function parseDiff(text) {
  const files = new Map();
  let current = null;
  let inHunk = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) { current = null; inHunk = false; continue; }
    if (!inHunk && line.startsWith('+++ ')) {
      const name = line.slice(4).replace(/^b\//, '');
      current = name === '/dev/null' ? null : name;
      if (current && !files.has(current)) files.set(current, { added: [], removed: [] });
      continue;
    }
    if (line.startsWith('@@')) { inHunk = true; continue; }
    if (!inHunk || !current) continue;
    if (line.startsWith('+')) files.get(current).added.push(line.slice(1));
    else if (line.startsWith('-')) files.get(current).removed.push(line.slice(1));
  }
  return files;
}

// Pure check. Inputs come from git (see main) or from tests.
export function analyze({ changed, deleted = [], diff = new Map(), progress = '', strict = false }) {
  const problems = [];
  const notes = [];
  let tripwireFired = false;

  if (changed.length === 0) problems.push('The diff is empty. There is nothing to review.');

  for (const file of changed) {
    for (const t of TRIPWIRES) {
      if (t.test(file)) { problems.push(`Red tripwire (${t.name}): ${file}`); tripwireFired = true; }
    }
  }
  for (const file of deleted) { problems.push(`Red tripwire (file deleted): ${file}`); tripwireFired = true; }

  for (const file of changed) {
    if (!isEngineFile(file)) continue;
    if (strict) problems.push(`Spoke changed an engine file, which the hub owns: ${file}`);
    else notes.push(`Engine file changed: ${file}. Confirm this is intended.`);
  }

  // Scope rule: while exactly one slice is [IN_PROGRESS], only its Target files (and .spec/) may change
  const active = progress.split('\n').filter((l) => ACTIVE_TASK.test(l));
  let sliceType = null;
  if (active.length > 1) {
    problems.push(`${active.length} slices are [IN_PROGRESS]. The harness allows only one.`);
  } else if (active.length === 1) {
    sliceType = active[0].match(SLICE_TYPE)?.[1] ?? null;
    const targets = (active[0].match(/Target files:\s*(.+)$/i)?.[1] || '')
      .replace(/[`*]/g, '').split(',').map((s) => s.trim().replace(/^\.\//, '')).filter(Boolean);
    // Same rule as the guard hook: exact file, or a file inside a listed folder
    const isAllowed = (file, allowed) =>
      file === allowed || file.startsWith(allowed.endsWith('/') ? allowed : `${allowed}/`);
    for (const file of changed) {
      if (file.startsWith('.spec/') || file === 'CLAUDE.md' || targets.some((t) => isAllowed(file, t))) continue;
      problems.push(`Outside the active slice's Target files: ${file}`);
    }
  } else {
    notes.push('Vibe Mode: no slice is in progress, so the Target files rule does not apply.');
  }

  // Test rule. Tests must not lose assertions, and skipped or focused tests are flagged.
  let addedAsserts = 0;
  let removedAsserts = 0;
  for (const [file, lines] of diff) {
    if (!isTestFile(file)) continue;
    addedAsserts += lines.added.filter((l) => ASSERTION.test(l)).length;
    removedAsserts += lines.removed.filter((l) => ASSERTION.test(l)).length;
    for (const line of lines.added) {
      if (SKIP_MARK.test(line)) problems.push(`Test skipped or focused in ${file}: ${line.trim()}`);
    }
  }
  if (removedAsserts > addedAsserts) {
    problems.push(`Yellow: ${removedAsserts - addedAsserts} assertion line(s) removed from tests with no replacement.`);
  }
  if (sliceType === 'CORE / DATA') {
    const testChanged = changed.some(isTestFile);
    if (!testChanged) {
      problems.push('CORE / DATA slice needs a test file change (*.test.*, *.spec.*, test_*.py, *_test.py, *_test.go). None changed.');
    } else if (addedAsserts === 0) {
      problems.push('CORE / DATA slice: test files changed but no assertion line was added or modified.');
    }
  }

  return { problems, notes, tripwireFired, sliceType };
}

export function report({ changed, problems, notes, tripwireFired, strict }) {
  const lines = [
    `Mode: ${strict ? 'strict (spoke, blocking)' : 'advisory (hub, never blocks)'}`,
    `Changed files: ${changed.length}`,
  ];
  if (problems.length === 0) lines.push('PR SCOPE: CLEAN');
  else lines.push('PR SCOPE: PROBLEMS', ...problems.map((p) => `- ${p}`));
  if (tripwireFired) lines.push('A Red tripwire fired, so this slice counts as Red. Stop and get a decision before merging.');
  if (notes.length) lines.push('Notes:', ...notes.map((n) => `- ${n}`));
  return lines.join('\n');
}

function main(argv) {
  const strict = argv.includes('--strict');
  const [base = 'origin/main', head = 'HEAD'] = argv.filter((a) => !a.startsWith('--'));
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const git = (...args) => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });

  let nameStatus;
  let diffText;
  try {
    nameStatus = git('diff', '--name-status', '-M', `${base}...${head}`);
    diffText = git('diff', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '-U0', `${base}...${head}`);
  } catch (err) {
    console.log(`PR SCOPE: ERROR. Could not diff ${base}...${head}: ${String(err.stderr || err.message).trim().split('\n')[0]}`);
    process.exit(strict ? 1 : 0);
  }

  let progress = '';
  try { progress = git('show', `${head}:.spec/PROGRESS.md`); } catch { /* no PROGRESS file: Vibe Mode */ }

  const { changed, deleted } = parseNameStatus(nameStatus);
  const result = analyze({ changed, deleted, diff: parseDiff(diffText), progress, strict });
  console.log(report({ changed, strict, ...result }));
  process.exit(strict && result.problems.length > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
