import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, parseDiff, parseNameStatus } from './pr-scope-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, 'pr-scope-check.mjs');

const ACTIVE = (type, targets) => `- [ ] **Slice X** [IN_PROGRESS] \`[GREEN][${type}]\`: thing — Target files: ${targets}\n`;
const testDiff = (file, added = [], removed = []) =>
  new Map([[file, { added, removed }]]);

test('parseNameStatus reports renames as a deletion plus a new file', () => {
  const out = parseNameStatus('M\tsrc/a.js\nD\told.js\nR086\tsrc/b.js\tsrc/c.js\n');
  assert.deepEqual(out.changed, ['src/a.js', 'src/c.js']);
  assert.deepEqual(out.deleted, ['old.js', 'src/b.js']);
});

test('parseDiff collects added and removed content lines per file', () => {
  const text = [
    'diff --git a/x.test.js b/x.test.js',
    '--- a/x.test.js',
    '+++ b/x.test.js',
    '@@ -1,2 +1,2 @@',
    '-  expect(a).toBe(1);',
    '+  expect(a).toBe(2);',
    '',
  ].join('\n');
  const files = parseDiff(text);
  assert.deepEqual(files.get('x.test.js'), { added: ['  expect(a).toBe(2);'], removed: ['  expect(a).toBe(1);'] });
});

test('a clean CORE / DATA slice with a new assertion passes', () => {
  const r = analyze({
    changed: ['.harness/scripts/foo.mjs', '.harness/scripts/foo.test.mjs'],
    diff: testDiff('.harness/scripts/foo.test.mjs', ['assert.equal(1, 1);']),
    progress: ACTIVE('CORE / DATA', '`.harness/scripts/`'),
  });
  assert.deepEqual(r.problems, []);
  assert.equal(r.sliceType, 'CORE / DATA');
});

test('CORE / DATA slice with no test file changed is a problem', () => {
  const r = analyze({
    changed: ['src/foo.js'],
    diff: new Map(),
    progress: ACTIVE('CORE / DATA', 'src/'),
  });
  assert.ok(r.problems.some((p) => p.includes('needs a test file change')));
});

test('CORE / DATA slice with a test file but no assertion added is a problem', () => {
  const r = analyze({
    changed: ['src/foo.test.js'],
    diff: testDiff('src/foo.test.js', ['// todo']),
    progress: ACTIVE('CORE / DATA', 'src/'),
  });
  assert.ok(r.problems.some((p) => p.includes('no assertion line was added')));
});

test('UI / VISUAL slice does not need a test file', () => {
  const r = analyze({ changed: ['src/view.css'], progress: ACTIVE('UI / VISUAL', 'src/') });
  assert.deepEqual(r.problems, []);
});

test('removing an assertion without a replacement is flagged as Yellow', () => {
  const r = analyze({
    changed: ['src/foo.test.js'],
    diff: testDiff('src/foo.test.js', ['// keep'], ['  expect(x).toEqual(3);']),
  });
  assert.ok(r.problems.some((p) => p.startsWith('Yellow:')));
});

test('a changed assertion (remove one, add one) is not flagged', () => {
  const r = analyze({
    changed: ['src/foo.test.js'],
    diff: testDiff('src/foo.test.js', ['  expect(x).toEqual(4);'], ['  expect(x).toEqual(3);']),
  });
  assert.deepEqual(r.problems, []);
});

test('an added skip or only in a test file is flagged', () => {
  const r = analyze({
    changed: ['src/foo.test.js'],
    diff: testDiff('src/foo.test.js', ["it.skip('later', () => {});", 'expect(1).toBe(1);']),
  });
  assert.ok(r.problems.some((p) => p.includes('skipped or focused')));
});

test('each Red tripwire fires and marks the slice Red', () => {
  const files = [
    'package.json', 'requirements.txt', 'db/migrations/001.sql', 'src/schema.ts',
    'src/auth/login.js', '.env.local', 'AGENTS.md', '.github/workflows/ci.yml',
  ];
  const r = analyze({ changed: files, progress: '' });
  assert.equal(r.tripwireFired, true);
  for (const f of files) assert.ok(r.problems.some((p) => p.includes(f)), `missing tripwire for ${f}`);
});

test('a deleted file is a Red tripwire', () => {
  const r = analyze({ changed: ['src/a.js'], deleted: ['src/old.js'], progress: '' });
  assert.ok(r.problems.some((p) => p.includes('(file deleted): src/old.js')));
});

test('author.md does not trip the auth wire', () => {
  const r = analyze({ changed: ['docs/author.md'], progress: '' });
  assert.equal(r.tripwireFired, false);
});

test('engine files: a note in the hub, a problem in strict spoke mode', () => {
  const hub = analyze({ changed: ['.harness/hooks/x.mjs'], progress: '', strict: false });
  assert.deepEqual(hub.problems, []);
  assert.ok(hub.notes.some((n) => n.includes('Engine file changed')));

  const spoke = analyze({ changed: ['.harness/hooks/x.mjs'], progress: '', strict: true });
  assert.ok(spoke.problems.some((p) => p.includes('engine file')));
});

test('spoke-owned project-rules.md is not an engine file', () => {
  const spoke = analyze({ changed: ['.claude/project-rules.md'], progress: '', strict: true });
  assert.deepEqual(spoke.problems, []);
});

test('two IN_PROGRESS slices is a problem', () => {
  const progress = ACTIVE('CORE / DATA', 'src/') + ACTIVE('UI / VISUAL', 'src/');
  const r = analyze({ changed: ['src/a.test.js'], diff: testDiff('src/a.test.js', ['expect(1).toBe(1);']), progress });
  assert.ok(r.problems.some((p) => p.includes('2 slices are [IN_PROGRESS]')));
});

test('strict CLI exits 1 on a deletion, advisory CLI exits 0 for the same diff', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-cli-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  fs.writeFileSync(path.join(dir, 'gone.js'), 'x\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'feature');
  fs.rmSync(path.join(dir, 'gone.js'));
  git('add', '-A');
  git('commit', '-q', '-m', 'delete');

  const run = (flag) => spawnSync(process.execPath, [SCRIPT, 'main', 'HEAD', ...(flag ? [flag] : [])], {
    cwd: dir, encoding: 'utf8',
  });
  const strict = run('--strict');
  assert.equal(strict.status, 1);
  assert.match(strict.stdout, /PR SCOPE: PROBLEMS/);
  assert.match(strict.stdout, /Red tripwire \(file deleted\)/);

  const advisory = run(null);
  assert.equal(advisory.status, 0);
  assert.match(advisory.stdout, /advisory/);

  fs.rmSync(dir, { recursive: true, force: true });
});
