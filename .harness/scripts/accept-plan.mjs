#!/usr/bin/env node
// Accept the slices listed in a plan file by marking them [x] in .spec/PROGRESS.md.
// Usage: node .harness/scripts/accept-plan.mjs <planFile>
// Node built-ins only.

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Plan format:
//   # Plan: <id>
//   - slice: <id>
export function parsePlan(text) {
  const lines = String(text).split(/\r?\n/);
  const header = lines.find((line) => line.trim() !== '');
  const match = header ? header.match(/^# Plan:\s*(\S+)\s*$/) : null;
  if (!match) {
    throw new Error('plan file must start with "# Plan: <id>"');
  }
  const sliceIds = [];
  for (const line of lines) {
    const slice = line.match(/^- slice:\s*(\S+)\s*$/);
    if (slice && !sliceIds.includes(slice[1])) {
      sliceIds.push(slice[1]);
    }
  }
  if (sliceIds.length === 0) {
    throw new Error('plan lists zero slices');
  }
  return { id: match[1], sliceIds };
}

export function acceptSlices(progressText, sliceIds, planId) {
  const lines = String(progressText).split('\n');
  const accepted = [];
  const already = [];
  const missing = [];

  for (const id of sliceIds) {
    const openPrefix = `- [ ] **Slice ${id}:`;
    const donePrefix = `- [x] **Slice ${id}:`;
    const idx = lines.findIndex(
      (line) => line.startsWith(openPrefix) || line.startsWith(donePrefix),
    );
    if (idx === -1) {
      missing.push(id);
      continue;
    }
    const line = lines[idx];
    if (line.startsWith(donePrefix)) {
      already.push(id);
      continue;
    }
    const cr = line.endsWith('\r') ? '\r' : '';
    let body = cr ? line.slice(0, -1) : line;
    body = body.replace(/\s*\[IN_PROGRESS\]/g, '');
    body = '- [x]' + body.slice('- [ ]'.length);
    lines[idx] = `${body.replace(/\s+$/, '')} Accepted-by-plan: ${planId}${cr}`;
    accepted.push(id);
  }

  return { text: lines.join('\n'), accepted, already, missing };
}

function isInsidePlans(file) {
  const plansDir = resolve(ROOT, '.spec', 'plans');
  const rel = relative(plansDir, file);
  return rel !== '' && rel.split(sep)[0] !== '..' && !isAbsolute(rel);
}

function main(args) {
  const arg = args[0];
  if (!arg) {
    console.error('usage: node .harness/scripts/accept-plan.mjs <planFile>');
    return 1;
  }
  const planPath = resolve(process.cwd(), arg);
  if (!isInsidePlans(planPath)) {
    console.error(`plan file must be inside .spec/plans/: ${arg}`);
    return 1;
  }
  const progressPath = resolve(ROOT, '.spec', 'PROGRESS.md');
  try {
    const plan = parsePlan(readFileSync(planPath, 'utf8'));
    const progress = readFileSync(progressPath, 'utf8');
    const result = acceptSlices(progress, plan.sliceIds, plan.id);
    if (result.missing.length > 0) {
      console.error(`missing slices: ${result.missing.join(', ')}`);
      return 1;
    }
    const tmp = `${progressPath}.tmp-${process.pid}`;
    writeFileSync(tmp, result.text, 'utf8');
    renameSync(tmp, progressPath);
    console.log(`accepted: ${result.accepted.length}, already: ${result.already.length}`);
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

const isDirect =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirect) {
  process.exitCode = main(process.argv.slice(2));
}
