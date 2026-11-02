import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { finishSlice } from './finish-slice.mjs';
import { verifyHeadTrust } from './referee.mjs';

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finish-slice-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  return dir;
}

test('finishSlice updates PROGRESS.md, commits with Referee trailers, and verifyHeadTrust passes', () => {
  const dir = makeRepo();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  fs.mkdirSync(path.join(dir, '.spec'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.harness', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.harness', 'scripts', 'referee.mjs'), '// referee');
  fs.writeFileSync(path.join(dir, '.spec', 'SESSION_HANDOFF.md'), '**Active Slice:** Slice 1\n**Verification Status:** pending\n');
  fs.writeFileSync(
    path.join(dir, '.spec', 'PROGRESS.md'),
    '# Progress\n- [ ] **Slice 1** `[GREEN][CORE / DATA]`: Test slice — Target files: test.txt [IN_PROGRESS]\n'
  );
  fs.writeFileSync(path.join(dir, 'test.txt'), 'content');

  // Initial commit
  git('add', '-A');
  git('commit', '-m', 'init');

  // Modify test.txt as part of the slice
  fs.writeFileSync(path.join(dir, 'test.txt'), 'updated content');

  const result = finishSlice(dir, 'feat: finish slice 1', { skipChecks: true });
  assert.equal(result.success, true);
  assert.equal(result.sliceId, '1');

  // Check PROGRESS.md was marked [x]
  const progressText = fs.readFileSync(path.join(dir, '.spec', 'PROGRESS.md'), 'utf8');
  assert.match(progressText, /- \[x\] \*\*Slice 1\*\*/);
  assert.doesNotMatch(progressText, /\[IN_PROGRESS\]/);

  // Check trailers via verifyHeadTrust
  const trust = verifyHeadTrust(dir, path.join(dir, '.harness', 'scripts', 'referee.mjs'));
  assert.equal(trust.trusted, true);
  assert.equal(trust.verdict, 'VERIFIED');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('finishSlice throws when a file outside Target files is modified (scope enforcement)', () => {
  const dir = makeRepo();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  fs.mkdirSync(path.join(dir, '.spec'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.harness', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.harness', 'scripts', 'referee.mjs'), '// referee');
  fs.writeFileSync(path.join(dir, '.spec', 'SESSION_HANDOFF.md'), '**Active Slice:** Slice 1\n');
  fs.writeFileSync(
    path.join(dir, '.spec', 'PROGRESS.md'),
    '# Progress\n- [ ] **Slice 1** `[GREEN][CORE / DATA]`: Test slice — Target files: test.txt [IN_PROGRESS]\n'
  );
  fs.writeFileSync(path.join(dir, 'test.txt'), 'content');
  fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'content');

  git('add', '-A');
  git('commit', '-m', 'init');

  // Modify target file AND an unrelated out-of-scope file
  fs.writeFileSync(path.join(dir, 'test.txt'), 'updated');
  fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'sneaky edit');

  assert.throws(
    () => finishSlice(dir, 'feat: finish slice 1', { skipChecks: true }),
    /Scope check failed: unrelated\.txt/
  );

  fs.rmSync(dir, { recursive: true, force: true });
});

test('finishSlice throws and fails to commit when verification tests fail', () => {
  const dir = makeRepo();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  fs.mkdirSync(path.join(dir, '.spec'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.harness', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.harness', 'scripts', 'referee.mjs'), '// referee');
  fs.writeFileSync(path.join(dir, '.spec', 'SESSION_HANDOFF.md'), '**Active Slice:** Slice 1\n');
  fs.writeFileSync(
    path.join(dir, '.spec', 'PROGRESS.md'),
    '# Progress\n- [ ] **Slice 1** `[GREEN][CORE / DATA]`: Test slice — Target files: test.txt [IN_PROGRESS]\n'
  );
  fs.writeFileSync(path.join(dir, 'test.txt'), 'content');
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'test', scripts: { test: 'node -e "process.exit(1)"' } })
  );

  git('add', '-A');
  git('commit', '-m', 'init');

  fs.writeFileSync(path.join(dir, 'test.txt'), 'updated');

  assert.throws(
    () => finishSlice(dir, 'feat: finish slice 1', { skipChecks: false }),
    /Verification tests failed/
  );

  // Verify slice was NOT marked [x]
  const progressText = fs.readFileSync(path.join(dir, '.spec', 'PROGRESS.md'), 'utf8');
  assert.match(progressText, /\[IN_PROGRESS\]/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('finishSlice enforces scope neutrality from HEAD to prevent working-copy target widening', () => {
  const dir = makeRepo();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  fs.mkdirSync(path.join(dir, '.spec'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.harness', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.harness', 'scripts', 'referee.mjs'), '// referee');
  fs.writeFileSync(path.join(dir, '.spec', 'SESSION_HANDOFF.md'), '**Active Slice:** Slice 1\n');
  fs.writeFileSync(
    path.join(dir, '.spec', 'PROGRESS.md'),
    '# Progress\n- [ ] **Slice 1** `[GREEN][CORE / DATA]`: Test slice — Target files: test.txt\n'
  );
  fs.writeFileSync(path.join(dir, 'test.txt'), 'content');
  fs.writeFileSync(path.join(dir, 'widened.txt'), 'content');

  git('add', '-A');
  git('commit', '-m', 'init');

  // Worker retroactively widens Target files in working copy of PROGRESS.md to include widened.txt
  fs.writeFileSync(
    path.join(dir, '.spec', 'PROGRESS.md'),
    '# Progress\n- [ ] **Slice 1** `[GREEN][CORE / DATA]`: Test slice — Target files: test.txt, widened.txt [IN_PROGRESS]\n'
  );
  fs.writeFileSync(path.join(dir, 'test.txt'), 'updated');
  fs.writeFileSync(path.join(dir, 'widened.txt'), 'unauthorized edit');

  // Must reject despite working-copy PROGRESS.md claiming widened.txt is in scope
  assert.throws(
    () => finishSlice(dir, 'feat: attempt widened slice', { skipChecks: true }),
    /Scope check failed: widened\.txt modified outside Target files for Slice 1/
  );

  fs.rmSync(dir, { recursive: true, force: true });
});
