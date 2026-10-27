#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const mode = (process.argv[2] || 'diff').toLowerCase();
const readSafe = (rel) => {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '_Not yet created_';
};

if (mode !== 'spec' && mode !== 'diff') {
  console.log(`✗ Unknown mode "${mode}". Use /prep-audit spec or /prep-audit diff.`);
  process.exit(0);
}

const overview = readSafe('.spec/OVERVIEW.md');
const spec = readSafe('.spec/SYSTEM_SPEC.md');
const progress = readSafe('.spec/PROGRESS.md');

// Local .md files that the spec/overview point to, via [text](file.md) links or bare REQUIREMENTS.md / ARCHITECTURE.md mentions
const collectReferences = (sources) => {
  const realRoot = fs.realpathSync(root);
  const skip = new Set(sources.map(({ rel }) => rel));
  skip.add('.spec/HANDOFF_PACKET.md');
  const found = new Map();
  for (const { rel, text } of sources) {
    const candidates = [];
    for (const m of text.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+\.md)(?:#[^)\s>]*)?>?[^)]*\)/gi)) candidates.push(m[1]);
    for (const m of text.matchAll(/[\w./-]*\b(?:REQUIREMENTS|ARCHITECTURE)\.md\b/g)) candidates.push(m[0]);
    for (const raw of candidates) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) continue;
      let ref = raw;
      try { ref = decodeURIComponent(raw); } catch { /* keep raw */ }
      const bases = [path.dirname(path.join(root, rel)), root];
      for (const base of bases) {
        const abs = ref.startsWith('/') ? path.join(root, ref) : path.resolve(base, ref);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        const real = fs.realpathSync(abs);
        const relPath = path.relative(realRoot, real).split(path.sep).join('/');
        if (relPath.startsWith('..') || path.isAbsolute(relPath) || skip.has(relPath) || found.has(relPath)) continue;
        found.set(relPath, fs.readFileSync(real, 'utf8'));
        break;
      }
    }
  }
  return found;
};

let payload = '';
if (mode === 'spec') {
  payload = `@arch-auditor Please conduct an adversarial architecture and scope audit on the following specification. Surface blind spots, edge cases, over-engineering, and verify [UI / VISUAL] vs [CORE / DATA] risk tags.\n\n# OVERVIEW\n${overview}\n\n# SYSTEM SPEC\n${spec}\n\n# PROGRESS & TASKS\n${progress}`;
  const refs = collectReferences([
    { rel: '.spec/SYSTEM_SPEC.md', text: spec },
    { rel: '.spec/OVERVIEW.md', text: overview },
  ]);
  if (refs.size > 0) {
    payload += '\n\n# APPENDED REFERENCES';
    for (const [rel, text] of refs) payload += `\n\n## ${rel}\n${text}`;
  }
} else {
  // Diff against HEAD through a throwaway copy of the index, so intent-to-add never touches the real one
  let diff = '';
  const tmpIndex = path.join(os.tmpdir(), `harness-bundle-index-${process.pid}`);
  const run = (cmd, env = {}) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 10 * 1024 * 1024, env: { ...process.env, ...env } });
  try {
    const realIndex = path.resolve(root, run('git rev-parse --git-path index').trim());
    if (fs.existsSync(realIndex)) fs.copyFileSync(realIndex, tmpIndex);
    run('git add -N .', { GIT_INDEX_FILE: tmpIndex });
    diff = run('git diff HEAD', { GIT_INDEX_FILE: tmpIndex });
  } catch {
    diff = '_Unable to compute git diff (not a git repo, or no commits yet)_';
  } finally {
    fs.rmSync(tmpIndex, { force: true });
  }
  payload = `@code-reviewer Please audit this implementation diff against our System Spec and active task slice. Identify bugs, security flaws, scope breaches, or regressions.\n\n# SYSTEM SPEC\n${spec}\n\n# ACTIVE PROGRESS\n${progress}\n\n# GIT DIFF\n\`\`\`diff\n${diff}\n\`\`\``;
}

const outPath = path.join(root, '.spec', 'HANDOFF_PACKET.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, payload, 'utf8');

if (os.platform() === 'darwin') {
  const copied = spawnSync('pbcopy', { input: payload });
  if (copied.status === 0) {
    console.log('✓ Packet written to .spec/HANDOFF_PACKET.md and auto-copied to macOS Clipboard.');
  } else {
    console.log('✓ Packet written to .spec/HANDOFF_PACKET.md (Clipboard unavailable; open file to copy).');
  }
} else {
  console.log(`✓ Packet saved to .spec/HANDOFF_PACKET.md (${payload.split('\n').length} lines); open it in the file panel to copy.`);
}
