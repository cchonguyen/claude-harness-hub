// Run with: node --test .harness/scripts/finish-slice.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { finishSlice, markSliceDone, nextPendingSlice, updateHandoff } from './finish-slice.mjs';

const dirs = [];
after(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const PROGRESS = `# Progress
- [x] **Slice 3.6** \`[GREEN][CORE / DATA]\`: done
- [ ] **Slice 3.7** \`[GREEN][CORE / DATA]\`: finisher [IN_PROGRESS]
- [ ] **Slice 3.8** \`[GREEN][CORE / DATA]\`: breaker
`;

const HANDOFF = `# SESSION HANDOFF
- **Active Slice:** none (Next pending: Slice 3.7)
- **Verification Status:** old
- **Branch Owner:** antigravity
`;

test('markSliceDone flips the named slice and drops the IN_PROGRESS tag', () => {
  const out = markSliceDone(PROGRESS, '3.7');
  assert.match(out, /- \[x\] \*\*Slice 3\.7\*\*/);
  assert.doesNotMatch(out, /IN_PROGRESS/);
  assert.match(out, /- \[ \] \*\*Slice 3\.8\*\*/, 'other slices stay pending');
});

test('markSliceDone returns null for a slice that is not pending', () => {
  assert.equal(markSliceDone(PROGRESS, '3.6'), null);
  assert.equal(markSliceDone(PROGRESS, '9.9'), null);
});

test('markSliceDone does not match 3.7 inside 3.70', () => {
  assert.equal(markSliceDone('- [ ] **Slice 3.70** x', '3.7'), null);
});

test('nextPendingSlice returns the first pending label or null', () => {
  assert.equal(nextPendingSlice(markSliceDone(PROGRESS, '3.7')), 'Slice 3.8');
  assert.equal(nextPendingSlice('- [x] **Slice 1** done\n'), null);
});

test('updateHandoff rewrites only the two status lines', () => {
  const out = updateHandoff(HANDOFF, { verification: 'Verified: x', next: 'Slice 3.8' });
  assert.match(out, /- \*\*Active Slice:\*\* none \(Next pending: Slice 3\.8\)/);
  assert.match(out, /- \*\*Verification Status:\*\* Verified: x/);
  assert.match(out, /- \*\*Branch Owner:\*\* antigravity/, 'Branch Owner must survive');
});

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finish-'));
  dirs.push(dir);
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  fs.mkdirSync(path.join(dir, '.spec'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.spec', 'PROGRESS.md'), PROGRESS);
  fs.writeFileSync(path.join(dir, '.spec', 'SESSION_HANDOFF.md'), HANDOFF);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  fs.writeFileSync(path.join(dir, 'feature.txt'), 'work\n');
  return dir;
}

const pass = () => ({ ok: true, output: '' });

test('finishSlice commits the slice with updated progress and handoff', () => {
  const root = makeRepo();
  const result = finishSlice({ root, slice: '3.7', check: 'node -e "process.exit(0)"', message: 'feat: slice 3.7', runScope: pass });
  assert.equal(result.ok, true);
  assert.equal(result.next, 'Slice 3.8');
  const subject = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(subject, 'feat: slice 3.7');
  const files = execFileSync('git', ['show', '--name-only', '--format=', 'HEAD'], { cwd: root, encoding: 'utf8' });
  assert.match(files, /feature\.txt/);
  assert.match(files, /\.spec\/PROGRESS\.md/);
  assert.match(fs.readFileSync(path.join(root, '.spec', 'SESSION_HANDOFF.md'), 'utf8'), /Next pending: Slice 3\.8/);
});

test('a failing quick check stops before anything is written or committed', () => {
  const root = makeRepo();
  const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const result = finishSlice({ root, slice: '3.7', check: 'node -e "process.exit(3)"', message: 'x', runScope: pass });
  assert.equal(result.ok, false);
  assert.equal(result.step, 'verify');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }), before);
  assert.match(fs.readFileSync(path.join(root, '.spec', 'PROGRESS.md'), 'utf8'), /\[ \] \*\*Slice 3\.7\*\*/);
});

test('a failing scope check stops the finish', () => {
  const root = makeRepo();
  const result = finishSlice({ root, slice: '3.7', check: 'node -e "process.exit(0)"', message: 'x', runScope: () => ({ ok: false, output: 'Red tripwire' }) });
  assert.equal(result.ok, false);
  assert.equal(result.step, 'scope');
});

test('an unknown or already-done slice is refused', () => {
  const root = makeRepo();
  const result = finishSlice({ root, slice: '3.6', check: 'node -e "process.exit(0)"', message: 'x', runScope: pass });
  assert.equal(result.ok, false);
  assert.equal(result.step, 'locate');
});
