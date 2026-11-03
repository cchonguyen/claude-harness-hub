#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

export function countLines(text) {
  if (!text) return 0;
  return text.endsWith('\n') ? text.slice(0, -1).split('\n').length : text.split('\n').length;
}

export function loadThresholds(root) {
  const configPath = path.join(root, '.harness', 'config', 'thresholds.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse .harness/config/thresholds.json: ${err.message}`);
  }
}

export function parseDeweyIndex(indexPath) {
  if (!fs.existsSync(indexPath)) {
    return { entries: new Map(), sections: new Set(), raw: '' };
  }
  const raw = fs.readFileSync(indexPath, 'utf8');
  const entries = new Map();
  const sections = new Set();

  for (const line of raw.split('\n')) {
    // Match section headers: ## 100 Work Dispatch
    const secMatch = line.match(/^##\s*(\d{3})\b\s*(.*)$/);
    if (secMatch) {
      sections.add(secMatch[1]);
      continue;
    }
    // Match entry lines:
    // - `110` [.spec/PROGRESS.md](...) — Active slice queue & lock
    // - `130` `.spec/CRIME_SCENE.md` — Active incident post-mortem & frozen diff
    const entryMatch = line.match(/^-\s*`(\d{3})`\s+(?:\[(.*?)\]\((.*?)\)|`([^`]+)`|(\S+))\s*(?:—|-|\s)?\s*(.*)$/);
    if (entryMatch) {
      const code = entryMatch[1];
      const linkText = entryMatch[2] || entryMatch[4] || entryMatch[5] || '';
      const href = entryMatch[3] || '';
      const desc = entryMatch[6] || '';
      entries.set(code, {
        code,
        target: linkText.trim(),
        href: href.trim(),
        desc: desc.trim(),
      });
    }
  }

  return { entries, sections, raw };
}

export function extractDeweyRefs(text) {
  const refs = new Set();
  if (!text) return refs;

  // 1. Match Refs: [110, 120, 210] or | Refs: [000, 305]
  const refsMatch = text.matchAll(/Refs:\s*\[([^\]]+)\]/gi);
  for (const m of refsMatch) {
    for (const code of m[1].split(',')) {
      const clean = code.trim();
      if (/^\d{3}$/.test(clean)) {
        refs.add(clean);
      }
    }
  }

  // 2. Match bracketed Dewey codes [110], [210] (not followed by '(' which indicates a markdown link)
  const bracketMatch = text.matchAll(/\[(\d{3})\](?!\()/g);
  for (const m of bracketMatch) {
    refs.add(m[1]);
  }

  // 3. Match Dewey Class 110, Dewey 320
  const deweyMatch = text.matchAll(/(?:Dewey(?:\s+Class)?)\s+(\d{3})\b/gi);
  for (const m of deweyMatch) {
    refs.add(m[1]);
  }

  return refs;
}

export function checkDeweyReferences(root) {
  const indexPath = path.join(root, '.spec', 'INDEX.md');
  const index = parseDeweyIndex(indexPath);
  const brokenRefs = [];
  const brokenLinks = [];

  // Known valid Dewey codes in index (entries + section headings)
  const validCodes = new Set([...index.entries.keys(), ...index.sections]);

  // Check if targets listed in INDEX.md exist on disk
  for (const [code, entry] of index.entries) {
    // 130 (.spec/CRIME_SCENE.md) is incident-only/ephemeral
    if (code === '130') continue;
    if (entry.target) {
      const targetRel = entry.target.replace(/^file:\/\/[^/]*\//, '').replace(/^\.\//, '');
      const fullPath = path.resolve(root, targetRel);
      if (!fs.existsSync(fullPath)) {
        brokenLinks.push({
          code,
          target: entry.target,
          reason: `Target file not found on disk: ${targetRel}`,
        });
      }
    }
  }

  // Scan .spec/ directory for references
  const specDir = path.join(root, '.spec');
  if (fs.existsSync(specDir)) {
    function walk(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) {
          walk(full);
        } else if (f.isFile() && f.name.endsWith('.md')) {
          const rel = path.relative(root, full);
          const content = fs.readFileSync(full, 'utf8');
          const refs = extractDeweyRefs(content);
          for (const code of refs) {
            if (!validCodes.has(code)) {
              brokenRefs.push({
                file: rel,
                code,
                reason: `Dewey reference [${code}] not found in .spec/INDEX.md`,
              });
            }
          }
        }
      }
    }
    walk(specDir);
  }

  return { brokenRefs, brokenLinks };
}

export function checkLineBudgets(root, thresholds) {
  const violations = [];
  const softCaps = thresholds?.line_budgets?.soft_caps || {};

  for (const [relPath, cap] of Object.entries(softCaps)) {
    const fullPath = path.join(root, relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = countLines(content);
      if (lines > cap) {
        violations.push({
          file: relPath,
          lines,
          cap,
          reason: `${relPath} exceeds soft cap: ${lines} lines (budget: ${cap})`,
        });
      }
    }
  }

  return violations;
}

export function archiveCompletedSlices(root) {
  const progressPath = path.join(root, '.spec', 'PROGRESS.md');
  const historyPath = path.join(root, '.spec', 'archive', 'HISTORY.md');

  if (!fs.existsSync(progressPath)) {
    return { archived: 0, remaining: 0 };
  }

  const progressText = fs.readFileSync(progressPath, 'utf8');
  const lines = progressText.split('\n');

  const completed = [];
  const remaining = [];

  for (const line of lines) {
    if (/^\s*-\s*\[x\]\s*\*\*Slice\b/i.test(line)) {
      completed.push(line);
    } else {
      remaining.push(line);
    }
  }

  if (completed.length === 0) {
    return { archived: 0, remaining: lines.length };
  }

  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  let historyText = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8') : '# Completed Slice Archive (Dewey Class 120)\n\n';

  if (!historyText.endsWith('\n')) historyText += '\n';
  historyText += `\n## Archived Slices (${new Date().toISOString().slice(0, 10)})\n`;
  for (const sliceLine of completed) {
    historyText += `${sliceLine.trim()}\n`;
  }

  fs.writeFileSync(historyPath, historyText, 'utf8');
  fs.writeFileSync(progressPath, remaining.join('\n'), 'utf8');

  return { archived: completed.length, remaining: remaining.length };
}

export function librarianCheck(root) {
  const thresholds = loadThresholds(root);
  const budgetViolations = thresholds ? checkLineBudgets(root, thresholds) : [];
  const { brokenRefs, brokenLinks } = checkDeweyReferences(root);

  const errors = [
    ...budgetViolations.map((v) => `Line budget violation: ${v.reason}`),
    ...brokenRefs.map((r) => `Broken Dewey reference: ${r.reason} (${r.file})`),
    ...brokenLinks.map((l) => `Broken INDEX link: ${l.reason} (code ${l.code})`),
  ];

  return {
    ok: errors.length === 0,
    errors,
    budgetViolations,
    brokenRefs,
    brokenLinks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolveRoot();
  const args = process.argv.slice(2);

  if (args.includes('--archive') || args.includes('--compact')) {
    const res = archiveCompletedSlices(root);
    console.log(`LIBRARIAN: Archived ${res.archived} completed slices to .spec/archive/HISTORY.md.`);
  }

  if (args.includes('--check')) {
    const check = librarianCheck(root);
    if (!check.ok) {
      console.error(`✗ LIBRARIAN CHECK FAILED: ${check.errors.length} error(s) found:`);
      for (const err of check.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log('✓ LIBRARIAN CHECK: PASS (0 errors). All Dewey references and line budgets valid.');
    process.exit(0);
  }

  if (!args.includes('--archive') && !args.includes('--compact') && !args.includes('--check')) {
    console.log('Usage: node .harness/scripts/librarian.mjs [--check] [--archive]');
    process.exit(0);
  }
}
