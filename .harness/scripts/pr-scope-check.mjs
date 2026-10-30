#!/usr/bin/env node
// Advisory scope check for a pull request. Reports problems and notes; never blocks a merge.
// Usage: node .harness/scripts/pr-scope-check.mjs [base=origin/main] [head=HEAD]
import { execFileSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const [base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
const ACTIVE_TASK = /^\s*-\s*\[.\].*\[IN_PROGRESS\]/;
const MANIFEST = /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|requirements[^/]*\.txt|pyproject\.toml|uv\.lock)$/;

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const problems = [];
const notes = [];

let changed = [];
try {
  changed = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean);
} catch (err) {
  console.log(`PR SCOPE: ERROR. Could not diff ${base}...${head}: ${String(err.stderr || err.message).trim().split('\n')[0]}`);
  process.exit(0);
}

if (changed.length === 0) problems.push('The diff is empty. There is nothing to review.');

// Scope rule: while exactly one slice is [IN_PROGRESS], only its Target files (and .spec/) may change
let progress = '';
try { progress = git('show', `${head}:.spec/PROGRESS.md`); } catch {}
const active = progress.split('\n').filter((l) => ACTIVE_TASK.test(l));

if (active.length > 1) {
  problems.push(`${active.length} slices are [IN_PROGRESS]. The harness allows only one.`);
} else if (active.length === 1) {
  const targets = (active[0].match(/Target files:\s*(.+)$/i)?.[1] || '')
    .replace(/[`*]/g, '').split(',').map((s) => s.trim().replace(/^\.\//, '')).filter(Boolean);
  for (const file of changed) {
    if (file.startsWith('.spec/') || targets.includes(file)) continue;
    problems.push(`Outside the active slice's Target files: ${file}`);
  }
} else {
  notes.push('Vibe Mode: no slice is in progress, so the Target files rule does not apply.');
}

// Engine files are owned by the hub. A spoke PR should not change them.
for (const file of changed) {
  if (file.startsWith('.claude/') || file.startsWith('.harness/')) notes.push(`Engine file changed: ${file}. Confirm this is intended.`);
  if (MANIFEST.test(file)) notes.push(`Dependency manifest changed: ${file}. Confirm the request needed it.`);
}

const lines = [`Changed files: ${changed.length}`];
if (problems.length === 0) lines.push('PR SCOPE: CLEAN');
else lines.push('PR SCOPE: PROBLEMS', ...problems.map((p) => `- ${p}`));
if (notes.length) lines.push('Notes:', ...notes.map((n) => `- ${n}`));
console.log(lines.join('\n'));
