#!/usr/bin/env node

/**
 * bin/update-state.mjs
 * Atomic state updater for .spec/STATE.json (Schema v2.2)
 *
 * Enforces single source of truth, schema validation, and guardrails
 * against agent self-certification of Verified and Accepted stages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

// Secret comes from HARNESS_VERIFY_SECRET or ~/.config/vibe-command-center/verify-secret (not in the repo).
function loadVerifySecret() {
  if (process.env.HARNESS_VERIFY_SECRET) return process.env.HARNESS_VERIFY_SECRET.trim();
  try {
    return fs.readFileSync(path.join(os.homedir(), '.config', 'vibe-command-center', 'verify-secret'), 'utf8').trim();
  } catch {
    return '';
  }
}
const VERIFICATION_SECRET = loadVerifySecret();

function runGit(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  } catch (err) {
    return '';
  }
}

function getWorktreeInfo() {
  const topLevel = runGit('rev-parse --show-toplevel');
  if (!topLevel) {
    throw new Error('Not currently inside a git repository or worktree.');
  }

  const branch = runGit('rev-parse --abbrev-ref HEAD') || 'HEAD';
  const worktreeId = path.basename(topLevel);

  let commonDir = runGit('rev-parse --git-common-dir');
  let projectId = worktreeId;
  if (commonDir) {
    const absCommon = path.resolve(topLevel, commonDir);
    projectId = path.basename(path.dirname(absCommon));
  }

  return { topLevel, worktreeId, projectId, branch };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    intent: null,
    stage: null,
    sliceId: null,
    sliceTitle: null,
    addDecision: null, // "id:prompt:contextFile"
    removeDecision: null, // "id"
    addRecent: null, // "id:tradeoff:decision:contextFile"
    verificationData: null,
    internalKey: null,
    bypassDecisions: null,
    removeSlice: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--intent' && args[i + 1]) options.intent = args[++i];
    else if (arg === '--stage' && args[i + 1]) options.stage = args[++i];
    else if (arg === '--slice-id' && args[i + 1]) options.sliceId = args[++i];
    else if (arg === '--slice-title' && args[i + 1]) options.sliceTitle = args[++i];
    else if (arg === '--add-decision' && args[i + 1]) options.addDecision = args[++i];
    else if (arg === '--remove-decision' && args[i + 1]) options.removeDecision = args[++i];
    else if (arg === '--add-recent' && args[i + 1]) options.addRecent = args[++i];
    else if (arg === '--set-verification' && args[i + 1]) options.verificationData = args[++i];
    else if (arg === '--internal-key' && args[i + 1]) options.internalKey = args[++i];
    else if (arg === '--bypass-decisions' && args[i + 1]) options.bypassDecisions = args[++i];
    else if (arg === '--remove-slice' && args[i + 1]) options.removeSlice = args[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: update-state.mjs [options]

Options:
  --intent <text>                Set current high-level intent
  --stage <enum>                 Set stage: Design, Falcon-Review, Implementation, Claimed, Verified, Accepted
  --slice-id <id>                Set active slice ID
  --slice-title <title>          Set active slice title
  --add-decision "id:prompt:file" Add a pending decision
  --remove-decision <id>         Resolve/remove a pending decision
  --add-recent "id:tradeoff:dec:file" Add an architectural decision record
  --set-verification <json>      Set verification evidence block (restricted)
  --internal-key <token>         Security token for Verified/Accepted stages
  --bypass-decisions '<reason>'  Explicitly bypass the decision requirement; logs a recentDecisions entry (min 10 chars)
  --remove-slice <id>            Remove a slice from activeSlices (one dashboard card per slice)
`);
}

function main() {
  const options = parseArgs();
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const { topLevel, worktreeId, projectId, branch } = getWorktreeInfo();
  const specDir = path.join(topLevel, '.spec');
  const statePath = path.join(specDir, 'STATE.json');
  const tmpPath = path.join(specDir, 'STATE.json.tmp');

  if (!fs.existsSync(specDir)) {
    fs.mkdirSync(specDir, { recursive: true });
  }

  // Load existing state or initialize schema v2.2 baseline
  let state = {
    schemaVersion: '2.2',
    updatedAt: new Date().toISOString(),
    projectId,
    worktreeId,
    branch,
    currentIntent: 'Initial exploration',
    stage: 'Design',
    pendingDecisions: [],
    recentDecisions: []
  };

  if (fs.existsSync(statePath)) {
    try {
      const raw = fs.readFileSync(statePath, 'utf8');
      state = { ...state, ...JSON.parse(raw) };
    } catch (e) {
      console.warn(`[WARN] Corrupted STATE.json encountered, resetting to v2.2 baseline: ${e.message}`);
    }
  }

  // Guardrail check: Agents cannot directly set Verified or Accepted without runner authentication
  if (options.stage === 'Verified' || options.stage === 'Accepted') {
    const providedKey = options.internalKey || process.env.HARNESS_VERIFY_SECRET;
    if (!VERIFICATION_SECRET || providedKey !== VERIFICATION_SECRET) {
      console.error(`\n[GUARDRAIL ERROR] Direct transition to stage '${options.stage}' is prohibited.`);
      console.error(`- 'Verified' must be set via 'bin/verify-slice.sh' after automated test execution.`);
      console.error(`- 'Accepted' must be set via 'bin/accept-slice.sh' with explicit human approval.\n`);
      process.exit(1);
    }
  }

  // Apply updates
  state.schemaVersion = '2.2';
  state.updatedAt = new Date().toISOString();
  state.projectId = projectId;
  state.worktreeId = worktreeId;
  state.branch = branch;

  if (options.intent) state.currentIntent = options.intent;
  if (options.stage) state.stage = options.stage;

  // activeSlices: one entry per slice (each becomes a dashboard card). activeSlice is kept for older readers.
  if (!Array.isArray(state.activeSlices)) {
    state.activeSlices = state.activeSlice?.id
      ? [{ id: state.activeSlice.id, title: state.activeSlice.title, stage: state.stage }]
      : [];
  }
  if (options.sliceId || options.sliceTitle) {
    const sid = options.sliceId || state.activeSlice?.id || 'slice-01';
    const stitle = options.sliceTitle || state.activeSlice?.title || 'Active Slice';
    const prev = state.activeSlices.find(s => s.id === sid) || {};
    const entry = { id: sid, title: stitle, stage: options.stage || prev.stage || state.stage, updatedAt: new Date().toISOString() };
    state.activeSlices = state.activeSlices.filter(s => s.id !== sid).concat([entry]);
    state.activeSlice = { id: sid, title: stitle };
  } else if (options.stage && state.activeSlice?.id) {
    // Stage change without --slice-id applies to the current slice.
    state.activeSlices = state.activeSlices.map(s => s.id === state.activeSlice.id ? { ...s, stage: options.stage, updatedAt: new Date().toISOString() } : s);
  }
  if (options.removeSlice) {
    state.activeSlices = state.activeSlices.filter(s => s.id !== options.removeSlice);
    if (state.activeSlice?.id === options.removeSlice) {
      const last = state.activeSlices[state.activeSlices.length - 1];
      state.activeSlice = last ? { id: last.id, title: last.title } : undefined;
    }
  }

  if (options.addDecision) {
    const parts = options.addDecision.split(':');
    if (parts.length >= 3) {
      const [id, prompt, contextFile] = parts;
      state.pendingDecisions = state.pendingDecisions.filter(d => d.id !== id);
      state.pendingDecisions.push({
        id,
        prompt,
        contextFile,
        createdAt: new Date().toISOString()
      });
    }
  }

  if (options.removeDecision) {
    state.pendingDecisions = state.pendingDecisions.filter(d => d.id !== options.removeDecision);
  }

  if (options.addRecent) {
    const [id, tradeoff, decision, contextFile] = options.addRecent.split(':');
    state.recentDecisions = state.recentDecisions.filter(d => d.id !== id);
    state.recentDecisions.unshift({
      id: id || `dec-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tradeoff: tradeoff || 'Unspecified trade-off',
      decision: decision || 'Documented choice',
      contextFile: contextFile || '.spec/decisions/general.md'
    });
    // Keep max 10 recent decisions
    state.recentDecisions = state.recentDecisions.slice(0, 10);
  }

  if (options.bypassDecisions !== null) {
    const reason = options.bypassDecisions.trim();
    if (reason.length < 10) {
      console.error('[ERROR] --bypass-decisions needs a reason of at least 10 non-whitespace characters.');
      process.exit(1);
    }
    const id = `bypass-${Date.now()}`;
    state.recentDecisions = state.recentDecisions.filter(d => d.id !== id);
    state.recentDecisions.unshift({
      id,
      timestamp: new Date().toISOString(),
      tradeoff: 'none',
      decision: `Explicitly bypassed: ${reason.slice(0, 500)}`,
      contextFile: 'none'
    });
    state.recentDecisions = state.recentDecisions.slice(0, 10);
  }

  if (options.verificationData) {
    try {
      state.verification = JSON.parse(options.verificationData);
    } catch (e) {
      console.error('[ERROR] Failed to parse verification data JSON:', e.message);
      process.exit(1);
    }
  }

  // Enforce schema constraints
  if (state.stage !== 'Design' && !state.activeSlice) {
    state.activeSlice = { id: 'slice-default', title: 'Work in progress' };
  }

  // Atomic write
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, statePath);

  console.log(`[STATE] Updated .spec/STATE.json -> stage: ${state.stage} (branch: ${state.branch}, slice: ${state.activeSlice?.id || 'none'})`);
}

main();
