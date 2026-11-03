import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseDeweyIndex,
  extractDeweyRefs,
  checkDeweyReferences,
  checkLineBudgets,
  archiveCompletedSlices,
  librarianCheck,
  countLines
} from './librarian.mjs';
import { freezeCrimeScene } from './freeze-crime-scene.mjs';
import { parseActiveTargets as parseTargetsFinish, finishSlice } from './finish-slice.mjs';
import { parseActiveTargets as parseTargetsScope, analyze as analyzeScope } from './pr-scope-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, 'librarian.mjs');

function makeTempSpecRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'librarian-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');

  fs.mkdirSync(path.join(dir, '.spec'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.spec', 'boundaries'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.spec', 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.spec', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.harness', 'config'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.harness', 'scripts'), { recursive: true });

  fs.writeFileSync(path.join(dir, '.harness', 'scripts', 'referee.mjs'), '// referee\n');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'initial b\n');

  // Create sample INDEX.md
  fs.writeFileSync(
    path.join(dir, '.spec', 'INDEX.md'),
    `# Dewey Decimal Spec Index

## 000 Card Catalog
- \`000\` [CLAUDE.md](CLAUDE.md) — 5-line pointer
- \`010\` [AGENTS.md](AGENTS.md) — Universal catalog

## 100 Work Dispatch
- \`110\` [.spec/PROGRESS.md](.spec/PROGRESS.md) — Active slice queue
- \`120\` [.spec/archive/HISTORY.md](.spec/archive/HISTORY.md) — Archive
- \`130\` \`.spec/CRIME_SCENE.md\` — Incident post-mortem

## 200 Boundaries
- \`210\` [.spec/boundaries/locks.md](.spec/boundaries/locks.md) — File locks
`
  );

  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'CLAUDE.md content\n');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'AGENTS.md content\n');
  fs.writeFileSync(
    path.join(dir, '.spec', 'PROGRESS.md'),
    `# Progress (Dewey Class 110)\n- [x] **Slice 1** Target files: a.txt | Refs: [110, 210]\n- [ ] **Slice 2** [IN_PROGRESS] Target files: b.txt | Refs: [000, 110]\n`
  );
  fs.writeFileSync(path.join(dir, '.spec', 'archive', 'HISTORY.md'), '# Completed Archive (Dewey Class 120)\n');
  fs.writeFileSync(path.join(dir, '.spec', 'boundaries', 'locks.md'), '# Locks (Dewey 210)\n');

  fs.writeFileSync(
    path.join(dir, '.harness', 'config', 'thresholds.json'),
    JSON.stringify({
      line_budgets: {
        soft_caps: {
          'CLAUDE.md': 5,
          'AGENTS.md': 40,
          '.spec/PROGRESS.md': 60,
        }
      }
    }, null, 2)
  );

  git('add', '-A');
  git('commit', '-m', 'init spec test repo');

  return dir;
}

test('librarianCheck passes on clean repository with valid Dewey refs and line limits', () => {
  const dir = makeTempSpecRepo();
  try {
    const res = librarianCheck(dir);
    assert.equal(res.ok, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.budgetViolations.length, 0);
    assert.equal(res.brokenRefs.length, 0);
    assert.equal(res.brokenLinks.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('extractDeweyRefs correctly extracts codes from Refs:, brackets, and headers', () => {
  const text = `
# Spec (Dewey Class 110)
Reference to [210] and [305].
- [ ] Slice 1 | Refs: [000, 010, 120]
Some note about Dewey 320.
Invalid ref [1] should not match 3-digit pattern.
`;
  const refs = extractDeweyRefs(text);
  assert.ok(refs.has('110'));
  assert.ok(refs.has('210'));
  assert.ok(refs.has('305'));
  assert.ok(refs.has('000'));
  assert.ok(refs.has('010'));
  assert.ok(refs.has('120'));
  assert.ok(refs.has('320'));
  assert.equal(refs.has('1'), false);
});

test('checkDeweyReferences detects broken/unregistered Dewey reference codes', () => {
  const dir = makeTempSpecRepo();
  try {
    // Add invalid reference [999] in PROGRESS.md
    fs.appendFileSync(
      path.join(dir, '.spec', 'PROGRESS.md'),
      '- [ ] **Slice 3** Target files: c.txt | Refs: [999]\n'
    );

    const { brokenRefs } = checkDeweyReferences(dir);
    assert.equal(brokenRefs.length, 1);
    assert.equal(brokenRefs[0].code, '999');
    assert.match(brokenRefs[0].reason, /not found in \.spec\/INDEX\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkDeweyReferences detects broken links in INDEX.md', () => {
  const dir = makeTempSpecRepo();
  try {
    // Add reference to non-existent file in INDEX.md
    fs.appendFileSync(
      path.join(dir, '.spec', 'INDEX.md'),
      '- `950` [.spec/missing.md](.spec/missing.md) — Missing file\n'
    );

    const { brokenLinks } = checkDeweyReferences(dir);
    assert.equal(brokenLinks.length, 1);
    assert.equal(brokenLinks[0].code, '950');
    assert.match(brokenLinks[0].reason, /Target file not found on disk/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkLineBudgets detects files exceeding soft caps', () => {
  const dir = makeTempSpecRepo();
  try {
    // Exceed CLAUDE.md soft cap (5 lines)
    fs.writeFileSync(
      path.join(dir, 'CLAUDE.md'),
      'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\n'
    );

    const thresholds = JSON.parse(fs.readFileSync(path.join(dir, '.harness', 'config', 'thresholds.json'), 'utf8'));
    const violations = checkLineBudgets(dir, thresholds);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].file, 'CLAUDE.md');
    assert.equal(violations[0].lines, 7);
    assert.equal(violations[0].cap, 5);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('archiveCompletedSlices archives completed slices to HISTORY.md and preserves active slices', () => {
  const dir = makeTempSpecRepo();
  try {
    const progressPath = path.join(dir, '.spec', 'PROGRESS.md');
    const historyPath = path.join(dir, '.spec', 'archive', 'HISTORY.md');

    const result = archiveCompletedSlices(dir);
    assert.equal(result.archived, 1);

    const progressAfter = fs.readFileSync(progressPath, 'utf8');
    assert.doesNotMatch(progressAfter, /\*\*Slice 1\*\*/);
    assert.match(progressAfter, /\*\*Slice 2\*\* \[IN_PROGRESS\]/);

    const historyAfter = fs.readFileSync(historyPath, 'utf8');
    assert.match(historyAfter, /\*\*Slice 1\*\*/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI librarian.mjs --check exits 0 on valid repository and 1 on violations', () => {
  const dir = makeTempSpecRepo();
  try {
    // 1. Clean repo should exit 0
    const pass = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: dir, encoding: 'utf8' });
    assert.equal(pass.status, 0);
    assert.match(pass.stdout, /LIBRARIAN CHECK: PASS/);

    // 2. Introduce violation: broken ref
    fs.appendFileSync(path.join(dir, '.spec', 'PROGRESS.md'), '- [ ] Invalid slice | Refs: [999]\n');
    const fail = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: dir, encoding: 'utf8' });
    assert.equal(fail.status, 1);
    assert.match(fail.stderr, /LIBRARIAN CHECK FAILED/);
    assert.match(fail.stderr, /\[999\]/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('freezeCrimeScene captures active slice, git status, diff, stashes, and creates CRIME_SCENE.md', () => {
  const dir = makeTempSpecRepo();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  try {
    // Make a dirty edit on slice 2
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'dirty edit in slice 2');

    const res = freezeCrimeScene(dir, 'Circuit breaker Strike 2 triggered in test.');
    assert.equal(res.sliceId, '2');
    assert.equal(res.stashCreated, true);
    assert.match(res.stashMessage, /crime-scene\/2/);

    // Check CRIME_SCENE.md was created
    const crimeScenePath = path.join(dir, '.spec', 'CRIME_SCENE.md');
    assert.ok(fs.existsSync(crimeScenePath));
    const content = fs.readFileSync(crimeScenePath, 'utf8');
    assert.match(content, /Dewey Class 130/);
    assert.match(content, /Active Slice:\*\* 2/);
    assert.match(content, /crime-scene\/2/);
    assert.match(content, /dirty edit in slice 2/);

    // Working directory should have dirty edits stashed (AGENTS.md no longer modified)
    const status = git('status', '--porcelain');
    const statusLines = status.split('\n').filter(Boolean);
    assert.ok(!statusLines.some((l) => l.includes('AGENTS.md')));
    assert.ok(statusLines.some((l) => l.includes('.spec/CRIME_SCENE.md')));

    // Stash should exist
    const stashList = git('stash', 'list');
    assert.match(stashList, /crime-scene\/2/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parseActiveTargets robustly strips | Refs, | Verify, [NEW], and backticks', () => {
  const line = '- [ ] **Slice 4.4: Engine** [IN_PROGRESS] Target files: `a.mjs`, `[NEW] b.mjs`, c.mjs | Refs: [110, 120] | Verify: npm test';
  const finishTargets = parseTargetsFinish(line);
  const scopeTargets = parseTargetsScope(line);

  assert.deepEqual(finishTargets, ['a.mjs', 'b.mjs', 'c.mjs']);
  assert.deepEqual(scopeTargets, ['a.mjs', 'b.mjs', 'c.mjs']);
});

test('pr-scope-check analyze verifies line budgets against soft caps', () => {
  const thresholds = {
    line_budgets: {
      soft_caps: {
        'CLAUDE.md': 5,
      }
    }
  };

  // 1. Within budget
  const pass = analyzeScope({
    changed: ['CLAUDE.md'],
    fileContents: { 'CLAUDE.md': '1\n2\n3\n' },
    thresholds,
  });
  assert.ok(!pass.problems.some((p) => p.includes('Line budget exceeded')));

  // 2. Exceeding budget
  const fail = analyzeScope({
    changed: ['CLAUDE.md'],
    fileContents: { 'CLAUDE.md': '1\n2\n3\n4\n5\n6\n7\n' },
    thresholds,
  });
  assert.ok(fail.problems.some((p) => p.includes('Line budget exceeded: CLAUDE.md has 7 lines (soft cap: 5)')));
});

test('finishSlice does not remove [IN_PROGRESS] if working tree has unstaged files outside scope', () => {
  const dir = makeTempSpecRepo();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  try {
    fs.writeFileSync(path.join(dir, '.spec', 'SESSION_HANDOFF.md'), '**Active Slice:** Slice 2\n');

    // Make an allowed target change
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b content');
    // Also create an untracked dirty file outside scope
    fs.writeFileSync(path.join(dir, 'untracked-rogue.txt'), 'rogue');

    assert.throws(
      () => finishSlice(dir, 'feat: attempt finish', { skipChecks: true }),
      /untracked-rogue\.txt/
    );

    // Verify [IN_PROGRESS] was preserved in PROGRESS.md
    const progress = fs.readFileSync(path.join(dir, '.spec', 'PROGRESS.md'), 'utf8');
    assert.match(progress, /\*\*Slice 2\*\* \[IN_PROGRESS\]/);
    assert.doesNotMatch(progress, /- \[x\] \*\*Slice 2\*\*/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('finishSlice git staging does not crash when tracking files are ignored by git', () => {
  const dir = makeTempSpecRepo();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  try {
    fs.writeFileSync(path.join(dir, '.spec', 'SESSION_HANDOFF.md'), '**Active Slice:** Slice 2\n');

    // Add .gitignore ignoring .spec/STATUS_BATCH.jsonl
    fs.writeFileSync(path.join(dir, '.gitignore'), '.spec/STATUS_BATCH.jsonl\n');
    git('add', '.gitignore');
    git('commit', '-m', 'add gitignore');

    // Create target file change
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b content updated');

    // finishSlice should stage and commit without crashing on ignored tracking file
    const res = finishSlice(dir, 'feat: finish with gitignored tracking file', { skipChecks: true });
    assert.equal(res.success, true);
    assert.equal(res.sliceId, '2');

    const progress = fs.readFileSync(path.join(dir, '.spec', 'PROGRESS.md'), 'utf8');
    assert.match(progress, /- \[x\] \*\*Slice 2\*\*/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
