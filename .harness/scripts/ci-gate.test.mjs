import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  parseRefereeTrailers,
  hasRefereeTrailer,
  addedSliceLines,
  sliceIdsFromProgressDiff,
  dashboardProblems,
  checkPullRequest,
  commitsMissingTrailer,
} from './ci-gate.mjs';

const TREE = 'a'.repeat(40);

function stateWith(...slices) {
  return JSON.stringify({ activeSlices: slices.map(([id, stage]) => ({ id, stage })) });
}

test('parseRefereeTrailers reads the two keys from a commit message', () => {
  const msg = `Finish Slice 7.1\n\nReferee-Verdict: VERIFIED\nReferee-Tree: ${TREE}\n`;
  assert.deepEqual(parseRefereeTrailers(msg), { verdict: 'VERIFIED', tree: TREE });
});

test('hasRefereeTrailer requires VERIFIED and a tree-shaped id', () => {
  assert.equal(hasRefereeTrailer(`x\n\nReferee-Verdict: VERIFIED\nReferee-Tree: ${TREE}`), true);
  assert.equal(hasRefereeTrailer(`x\n\nReferee-Verdict: FAILED\nReferee-Tree: ${TREE}`), false);
  assert.equal(hasRefereeTrailer('x\n\nReferee-Verdict: VERIFIED'), false);
  assert.equal(hasRefereeTrailer(`x\n\nReferee-Verdict: VERIFIED\nReferee-Tree: nope`), false);
  assert.equal(hasRefereeTrailer('plain commit'), false);
});

test('addedSliceLines counts only added slice lines', () => {
  const diff = [
    '+++ b/.spec/PROGRESS.md',
    '-- [ ] **Slice 7.1: Old**',
    '+- [x] **Slice 7.1: Gate**  Target files: a.mjs',
    '+- [x] Not a slice line',
    '+Some note about **Slice 9**',
  ].join('\n');
  assert.deepEqual(addedSliceLines(diff), ['- [x] **Slice 7.1: Gate**  Target files: a.mjs']);
});

function sh(cwd, args, env = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com', ...env },
  }).trim();
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-'));
  sh(dir, ['init', '-q', '-b', 'main']);
  fs.mkdirSync(path.join(dir, '.spec'));
  fs.writeFileSync(path.join(dir, '.spec', 'PROGRESS.md'), '- [ ] **Slice 1.1: First**\n');
  fs.writeFileSync(path.join(dir, 'app.txt'), 'v1\n');
  sh(dir, ['add', '-A']);
  sh(dir, ['commit', '-q', '-m', 'base']);
  sh(dir, ['checkout', '-q', '-b', 'feature']);
  return dir;
}

function commitWithTrailers(dir, message, { tree } = {}) {
  sh(dir, ['add', '-A']);
  const treeId = tree || sh(dir, ['write-tree']);
  sh(dir, ['commit', '-q', '-m', message, '--trailer', 'Referee-Verdict: VERIFIED', '--trailer', `Referee-Tree: ${treeId}`]);
}

test('sliceIdsFromProgressDiff extracts added slice ids and ignores removed lines', () => {
  const diff = [
    '+++ b/.spec/PROGRESS.md',
    '-- [x] **Slice 7.2: Old**',
    '+- [ ] **Slice 7.3: Dashboard check**  Target files: .harness/scripts/ci-gate.mjs',
  ].join('\n');
  assert.deepEqual(sliceIdsFromProgressDiff(diff), ['7.3']);
});

test('dashboardProblems returns nothing when the PR adds no slice', () => {
  assert.deepEqual(dashboardProblems({ sliceIds: [], stateText: null }), []);
});

test('dashboardProblems reports a missing STATE.json once', () => {
  const problems = dashboardProblems({ sliceIds: ['7.3'], stateText: null });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /STATE\.json/);
});

test('dashboardProblems reports a slice absent from activeSlices and names the id', () => {
  const problems = dashboardProblems({ sliceIds: ['7.3'], stateText: stateWith(['7.1', 'Claimed']) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /slice 7\.3/);
});

test('dashboardProblems flags a slice still at Implementation', () => {
  const problems = dashboardProblems({ sliceIds: ['7.3'], stateText: stateWith(['7.3', 'Implementation']) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Implementation/);
});

test('dashboardProblems accepts a slice at Claimed', () => {
  assert.deepEqual(dashboardProblems({ sliceIds: ['7.3'], stateText: stateWith(['7.3', 'Claimed']) }), []);
});

test('dashboardProblems reports invalid JSON', () => {
  const problems = dashboardProblems({ sliceIds: ['7.3'], stateText: '{not json' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not valid JSON/);
});

function writeState(dir, stateText = stateWith(['1.1', 'Claimed'])) {
  fs.writeFileSync(path.join(dir, '.spec', 'STATE.json'), stateText);
}

test('checkPullRequest passes for a slice commit with a matching verdict', () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, '.spec', 'PROGRESS.md'), '- [x] **Slice 1.1: First**\n');
  fs.writeFileSync(path.join(dir, 'app.txt'), 'v2\n');
  writeState(dir);
  commitWithTrailers(dir, 'Finish Slice 1.1');
  assert.deepEqual(checkPullRequest({ base: 'main', head: 'feature', cwd: dir }), []);
});

test('checkPullRequest fails when the added slice is missing from STATE.json', () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, '.spec', 'PROGRESS.md'), '- [x] **Slice 1.1: First**\n');
  writeState(dir, stateWith(['9.9', 'Claimed']));
  commitWithTrailers(dir, 'Finish Slice 1.1');
  const problems = checkPullRequest({ base: 'main', head: 'feature', cwd: dir });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Dashboard: slice 1\.1/);
});

test('checkPullRequest fails when the PR adds no slice', () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'app.txt'), 'v2\n');
  commitWithTrailers(dir, 'Quick fix');
  const problems = checkPullRequest({ base: 'main', head: 'feature', cwd: dir });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /No slice/);
});

test('checkPullRequest fails when the head commit has no Referee trailer', () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, '.spec', 'PROGRESS.md'), '- [x] **Slice 1.1: First**\n');
  writeState(dir);
  sh(dir, ['add', '-A']);
  sh(dir, ['commit', '-q', '-m', 'Hand edit']);
  const problems = checkPullRequest({ base: 'main', head: 'feature', cwd: dir });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /No Referee trailer/);
});

test('checkPullRequest fails when the commit changed after its verdict', () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, '.spec', 'PROGRESS.md'), '- [x] **Slice 1.1: First**\n');
  writeState(dir);
  commitWithTrailers(dir, 'Finish Slice 1.1', { tree: 'b'.repeat(40) });
  const problems = checkPullRequest({ base: 'main', head: 'feature', cwd: dir });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Stale verdict/);
});

test('commitsMissingTrailer lists only the pushed commits without a verdict', () => {
  const dir = makeRepo();
  const before = sh(dir, ['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(dir, 'app.txt'), 'v2\n');
  sh(dir, ['add', '-A']);
  sh(dir, ['commit', '-q', '-m', 'Hand edit on main']);
  fs.writeFileSync(path.join(dir, 'app.txt'), 'v3\n');
  commitWithTrailers(dir, 'Finish Slice 1.1');
  const after = sh(dir, ['rev-parse', 'HEAD']);
  const missing = commitsMissingTrailer({ before, after, cwd: dir });
  assert.equal(missing.length, 1);
  assert.match(missing[0], /Hand edit on main/);
});

test('commitsMissingTrailer on a new branch checks only the tip commit', () => {
  const dir = makeRepo();
  const after = sh(dir, ['rev-parse', 'HEAD']);
  const missing = commitsMissingTrailer({ before: '0'.repeat(40), after, cwd: dir });
  assert.equal(missing.length, 1);
});
