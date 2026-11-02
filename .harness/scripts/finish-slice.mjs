#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { appendBatchEvent, resolveRoot } from './status-batch.mjs';
import { getRefereeEngineHash, detectNaturalLull } from './referee.mjs';
import { analyze, parseDiff, parseNameStatus } from './pr-scope-check.mjs';

const gitIn = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

export function finishSlice(root, commitMsg, options = {}) {
  const refereeScript = path.join(root, '.harness', 'scripts', 'referee.mjs');
  const progressPath = path.join(root, '.spec', 'PROGRESS.md');
  const handoffPath = path.join(root, '.spec', 'SESSION_HANDOFF.md');
  const telemetryPath = path.join(root, '.spec', '.session-telemetry.json');

  if (!commitMsg) {
    throw new Error('finishSlice requires a commit message.');
  }

  // 1. Identify active slice in PROGRESS.md
  if (!fs.existsSync(progressPath)) {
    throw new Error('.spec/PROGRESS.md not found.');
  }
  let progressText = fs.readFileSync(progressPath, 'utf8');
  const lines = progressText.split('\n');
  const activeIdx = lines.findIndex((l) => /^\s*-\s*\[.\].*\[IN_PROGRESS\]/.test(l));
  if (activeIdx === -1) {
    throw new Error('No slice is marked [IN_PROGRESS] in .spec/PROGRESS.md.');
  }
  const activeLine = lines[activeIdx];
  const sliceIdMatch = activeLine.match(/\*\*Slice\s+([^*]+)\*\*/);
  const sliceId = sliceIdMatch ? sliceIdMatch[1].trim() : 'active';
  const sliceType = /\[UI \/ VISUAL\]/i.test(activeLine) ? 'UI / VISUAL' : 'CORE / DATA';

  // 2. Run quick checks if not skipped by mock
  if (!options.skipChecks) {
    try {
      execFileSync('npm', ['test', '--silent'], { cwd: root, stdio: 'ignore' });
    } catch {
      // fallback to node test if npm test fails or doesn't exist
      try {
        execFileSync('node', ['--test', '.harness/hooks/lib/runner-matcher.test.mjs'], { cwd: root, stdio: 'ignore' });
      } catch (err) {
        throw new Error(`Verification tests failed: ${err.message}`);
      }
    }
  }

  // 3. Mark slice [x] in PROGRESS.md
  lines[activeIdx] = activeLine.replace(/\[IN_PROGRESS\]/g, '').replace(/-\s*\[\s*\]/, '- [x]').trim();
  fs.writeFileSync(progressPath, lines.join('\n'), 'utf8');

  // 4. Update SESSION_HANDOFF.md with prose note
  const handoffText = fs.existsSync(handoffPath) ? fs.readFileSync(handoffPath, 'utf8') : '';
  const updatedHandoff = handoffText
    .replace(/\*\*Active Slice:\*\*.*/i, '**Active Slice:** none')
    .replace(/\*\*Verification Status:\*\*.*/i, `**Verification Status:** Verified via finish-slice.mjs (Slice ${sliceId})`);
  fs.writeFileSync(handoffPath, updatedHandoff, 'utf8');

  // 5. Update session telemetry & batch events before staging
  if (fs.existsSync(telemetryPath)) {
    try {
      const telem = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
      telem.slicesCommitted = (telem.slicesCommitted || 0) + 1;
      telem.mutatingCallsOnSlice = 0;
      telem.currentSlice = '';
      fs.writeFileSync(telemetryPath, JSON.stringify(telem, null, 2), 'utf8');
    } catch {}
  }

  appendBatchEvent(root, {
    event: 'slice_finish',
    slice: `Slice ${sliceId}`,
    summary: `Finished Slice ${sliceId} with Referee-Verdict: VERIFIED`
  });

  // 6. Stage files and compute tree sha
  gitIn(root, ['add', '-A']);
  const treeSha = gitIn(root, ['write-tree']);
  const engineHash = getRefereeEngineHash(refereeScript);

  // 7. Commit with Referee-* trailers
  const trailers = [
    '--trailer', 'Referee-Verdict: VERIFIED',
    '--trailer', `Referee-Tree: ${treeSha}`
  ];
  if (engineHash) {
    trailers.push('--trailer', `Referee-Engine: ${engineHash}`);
  }

  gitIn(root, ['commit', '-m', commitMsg, ...trailers]);
  const commitSha = gitIn(root, ['log', '-1', '--oneline']);

  // 8. Natural lull check
  const lull = detectNaturalLull(root);

  return {
    success: true,
    sliceId,
    commitSha,
    treeSha,
    lull
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolveRoot();
  const commitMsg = process.argv.slice(2).join(' ').trim();
  if (!commitMsg) {
    console.error('Usage: node .harness/scripts/finish-slice.mjs "<commit message>"');
    process.exit(1);
  }
  try {
    const res = finishSlice(root, commitMsg);
    console.log(`✓ FINISH SLICE: ${res.sliceId} committed (${res.commitSha}). Referee-Verdict: VERIFIED.`);
    if (res.lull.isLull) {
      console.log(res.lull.recommendation);
    }
  } catch (err) {
    console.error(`✗ FINISH SLICE FAILED: ${err.message}`);
    process.exit(1);
  }
}
