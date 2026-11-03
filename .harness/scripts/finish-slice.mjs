#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { appendBatchEvent, resolveRoot } from './status-batch.mjs';
import { getRefereeEngineHash, detectNaturalLull } from './referee.mjs';

const gitIn = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

export function parseActiveTargets(line) {
  if (!line) return [];
  const targetPart = line.split('|')[0];
  const match = targetPart.match(/Target files:\s*([^\n]+)/i);
  if (!match) return [];
  return match[1]
    .replace(/\[NEW\]/gi, '')
    .replace(/\[IN_PROGRESS\]/gi, '')
    .replace(/\[DELETE\]/gi, '')
    .replace(/[`*]/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^\.\//, ''))
    .filter(Boolean);
}

export function isTargetMatch(relFile, targets) {
  const norm = relFile.replace(/\\/g, '/');
  const trackingFiles = [
    '.spec/PROGRESS.md',
    '.spec/SESSION_HANDOFF.md',
    '.spec/.session-telemetry.json',
    '.spec/STATUS_BATCH.jsonl',
  ];
  if (trackingFiles.includes(norm)) return true;

  // Allow hook test file when hook targets are modified
  if ((targets.includes('.harness/hooks/el-exit-gate.mjs') || targets.includes('.harness/hooks/pre-tool-guard.mjs')) &&
      norm === '.harness/hooks/lib/guard-rules.test.mjs') {
    return true;
  }

  // Allow synced agent files when .harness/agents/ templates are targets
  if (targets.some((t) => t.startsWith('.harness/agents/')) &&
      (norm.startsWith('.claude/agents/') || (norm.startsWith('.agents/') && !norm.startsWith('.agents/rules/') && !norm.startsWith('.agents/skills/')))) {
    return true;
  }

  return targets.some((target) => {
    const clean = target.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!clean) return false;
    if (clean.endsWith('/')) {
      return norm.startsWith(clean);
    }
    if (norm === clean || norm.startsWith(clean + '/')) {
      return true;
    }
    return norm.startsWith(clean);
  });
}

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
  const sliceIdMatch = activeLine.match(/\*\*Slice\s+([^:*]+)/i);
  const sliceId = sliceIdMatch ? sliceIdMatch[1].trim() : 'active';

  // Scope Neutrality (SYSTEM_SPEC 5.B): Read Target files strictly from HEAD:.spec/PROGRESS.md to prevent
  // workers from retroactively widening scope in the mutable working copy. Fail closed if not in HEAD.
  let headProgress = '';
  try {
    headProgress = execFileSync('git', ['show', 'HEAD:.spec/PROGRESS.md'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {}

  if (!headProgress) {
    throw new Error('Scope neutrality violation: HEAD:.spec/PROGRESS.md could not be read from git.');
  }

  const headLines = headProgress.split('\n');
  const headSliceLine = headLines.find((l) =>
    (sliceIdMatch && l.includes(sliceIdMatch[0])) ||
    l.includes(`**Slice ${sliceId}**`) ||
    l.includes(`**Slice ${sliceId}:`)
  );
  if (!headSliceLine) {
    throw new Error(`Scope neutrality violation: Slice ${sliceId} does not exist in HEAD:.spec/PROGRESS.md. Commit slice plan to HEAD before implementing.`);
  }

  const targets = parseActiveTargets(headSliceLine);
  if (targets.length === 0) {
    throw new Error(`Scope neutrality violation: Slice ${sliceId} in HEAD:.spec/PROGRESS.md declares no Target files.`);
  }

  // 2. Enforce scope neutrality before modifying or staging files
  const statusOut = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  const statusLines = statusOut.split('\n').filter(Boolean);
  const changedFiles = statusLines.map((l) => l.slice(2).trim().replace(/.* -> /, ''));

  const outOfScope = changedFiles.filter((f) => !isTargetMatch(f, targets));
  if (outOfScope.length > 0) {
    throw new Error(`Scope check failed: ${outOfScope.join(', ')} modified outside Target files for Slice ${sliceId}.`);
  }

  // 3. Run verification tests (never mask failures)
  if (!options.skipChecks) {
    let testRan = false;
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts?.test) {
          execFileSync('npm', ['test'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          testRan = true;
        }
      } catch (err) {
        const output = (err.stdout || '') + (err.stderr || '');
        throw new Error(`Verification tests failed (npm test):\n${output || err.message}`);
      }
    }
    if (!testRan) {
      try {
        execFileSync('node', ['--test', '.harness/hooks/lib/runner-matcher.test.mjs', '.harness/scripts/referee.test.mjs'], {
          cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch (err) {
        const output = (err.stdout || '') + (err.stderr || '');
        throw new Error(`Verification tests failed (node --test):\n${output || err.message}`);
      }
    }
  }

  // 4. Update PROGRESS.md and commit atomically (never remove [IN_PROGRESS] if commit fails)
  const originalProgressText = progressText;
  const originalHandoffText = fs.existsSync(handoffPath) ? fs.readFileSync(handoffPath, 'utf8') : '';
  let committed = false;

  try {
    lines[activeIdx] = activeLine.replace(/\[IN_PROGRESS\]/g, '').replace(/-\s*\[\s*\]/, '- [x]').trim();
    fs.writeFileSync(progressPath, lines.join('\n'), 'utf8');

    // 5. Update SESSION_HANDOFF.md
    const handoffText = originalHandoffText;
    const updatedHandoff = handoffText
      .replace(/\*\*Active Slice:\*\*.*/i, '**Active Slice:** none')
      .replace(/\*\*Verification Status:\*\*.*/i, `**Verification Status:** Verified via finish-slice.mjs (Slice ${sliceId})`);
    fs.writeFileSync(handoffPath, updatedHandoff, 'utf8');

    // 6. Update session telemetry & batch events
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

    // 7. Stage ONLY target files and tracking files (never git add -A)
    const trackingFiles = [
      '.spec/PROGRESS.md',
      '.spec/SESSION_HANDOFF.md',
      '.spec/.session-telemetry.json',
      '.spec/STATUS_BATCH.jsonl',
    ];
    let allPermitted = Array.from(new Set([...changedFiles, ...trackingFiles]))
      .filter((f) => isTargetMatch(f, targets) && fs.existsSync(path.join(root, f)));

    if (allPermitted.length > 0) {
      try {
        const ignoredOut = execFileSync('git', ['check-ignore', '--', ...allPermitted], {
          cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
        });
        const ignored = new Set(ignoredOut.split('\n').map((s) => s.trim()).filter(Boolean));
        allPermitted = allPermitted.filter((f) => !ignored.has(f));
      } catch {
        // check-ignore exit 1 means none of the files are ignored
      }
    }

    if (allPermitted.length > 0) {
      execFileSync('git', ['add', '--ignore-errors', '--', ...allPermitted], { cwd: root, stdio: 'ignore' });
    }

    // Verify no unstaged dirty files remain
    const remainingDirty = gitIn(root, ['status', '--porcelain']);
    const unstaged = remainingDirty.split('\n').filter(Boolean).filter((l) => !/^[MADRC] /.test(l));
    if (unstaged.length > 0) {
      throw new Error(`Working tree contains uncommitted files outside slice scope:\n${unstaged.join('\n')}`);
    }

    const treeSha = gitIn(root, ['write-tree']);
    const engineHash = getRefereeEngineHash(refereeScript);

    // 8. Commit with Referee-* trailers
    const trailers = [
      '--trailer', 'Referee-Verdict: VERIFIED',
      '--trailer', `Referee-Tree: ${treeSha}`
    ];
    if (engineHash) {
      trailers.push('--trailer', `Referee-Engine: ${engineHash}`);
    }

    gitIn(root, ['commit', '-m', commitMsg, ...trailers]);
    committed = true;
    const commitSha = gitIn(root, ['log', '-1', '--oneline']);

    // 9. Natural lull check
    const lull = detectNaturalLull(root);

    return {
      success: true,
      sliceId,
      commitSha,
      treeSha,
      lull
    };
  } catch (err) {
    if (!committed) {
      // Rollback PROGRESS.md so [IN_PROGRESS] is preserved if commit fails
      fs.writeFileSync(progressPath, originalProgressText, 'utf8');
      if (originalHandoffText) {
        fs.writeFileSync(handoffPath, originalHandoffText, 'utf8');
      }
    }
    throw err;
  }
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
