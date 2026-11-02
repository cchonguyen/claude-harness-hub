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
