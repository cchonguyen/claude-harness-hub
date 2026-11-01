#!/usr/bin/env node
// Sync harness engine files from the hub into a spoke, respecting who owns each file.
// Usage:
//   node .harness/scripts/hub-sync.mjs pull            (default) refresh hub-owned files in this project
//   node .harness/scripts/hub-sync.mjs push            send a learned rule to the hub on a fresh branch
//   node .harness/scripts/hub-sync.mjs init --target D create a new spoke at D from the hub, then pull
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  AGENTS_MARKERS, GITIGNORE_MARKERS, PROJECT_RULES, SETTINGS_SPOKE, TEMPLATE_ONLY,
  appendActiveRules, learnedRulesToKeep, listHubOwned, mergeBlock, mergeSettings,
  readManifest, sha256, spokeOnlyPermissions, writeManifest,
} from './lib/sync-core.mjs';

// execFileSync passes arguments without a shell, so quotes, $ and backticks in a rule are inert
const gitIn = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitRoot = () => { try { return gitIn(process.cwd(), 'rev-parse', '--show-toplevel'); } catch { return ''; } };

const argv = process.argv.slice(2);
const action = (argv[0] || 'pull').toLowerCase();
const targetFlag = argv.indexOf('--target');
const targetArg = targetFlag !== -1 ? argv[targetFlag + 1] : '';
const root = targetArg ? path.resolve(targetArg) : (process.env.CLAUDE_PROJECT_DIR || gitRoot() || process.cwd());
const stagingFile = path.join(root, '.spec', '.learn-staging.txt');
const hub = (() => {
  try { return { repo: 'claude-harness-hub', branch: 'main', ...JSON.parse(fs.readFileSync(path.join(root, '.harness', 'hub.json'), 'utf8')) }; } catch { return { repo: 'claude-harness-hub', branch: 'main' }; }
})();
const reason = (err) => String(err.stderr || err.stdout || err.message).trim().split('\n')[0];
const readText = (file, fallback = '') => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fallback);
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

if (!['pull', 'push', 'init'].includes(action)) {
  console.log(`✗ Unknown action "${action}". Use pull, push, or init --target <dir>.`);
  process.exit(0);
}

let note = 'Sync harness engine files';
if (action === 'push' && fs.existsSync(stagingFile)) {
  note = fs.readFileSync(stagingFile, 'utf8').trim().split('\n')[0] || note;
  fs.unlinkSync(stagingFile);
}

const isGitCheckout = (dir) => { try { return gitIn(dir, 'rev-parse', '--show-toplevel') === fs.realpathSync(dir); } catch { return false; } };
const originUrl = (dir) => { try { return gitIn(dir, 'remote', 'get-url', 'origin'); } catch { return ''; } };
const isHubCheckout = (dir) =>
  isGitCheckout(dir) && (path.basename(dir) === hub.repo || new RegExp(`[/:]${hub.repo}(\\.git)?$`).test(originUrl(dir)));

// Running inside the hub repo itself: commit engine files on the current branch
if (action !== 'init' && isHubCheckout(root)) {
  if (action === 'pull') {
    console.log(`✓ This is the ${hub.repo} repo itself; engine files are already the source of truth.`);
  } else {
    try {
      gitIn(root, 'add', '--', '.claude', '.harness', '.harness-version');
      gitIn(root, 'commit', '-m', `chore(harness): ${note}`, '--', '.claude', '.harness', '.harness-version');
      console.log(`✓ Committed rule in the hub repo on ${gitIn(root, 'branch', '--show-current')} ("${note}"). Push the branch and open a PR via GitHub MCP.`);
    } catch (err) {
      console.log(`✓ Rule saved in .claude/harness-rules.md, but nothing was committed. Git said: ${reason(err)}`);
    }
  }
  process.exit(0);
}

// Cloud sessions clone every attached repo side by side, so look next to (and one level around) the project
function findSibling() {
  const candidates = [process.env.HARNESS_HUB_DIR, path.join(root, '..', hub.repo)].filter(Boolean);
  const parent = path.dirname(root);
  try {
    for (const d of fs.readdirSync(parent, { withFileTypes: true })) if (d.isDirectory()) candidates.push(path.join(parent, d.name));
  } catch {}
  return candidates.map((c) => path.resolve(c)).find((c) => c !== path.resolve(root) && fs.existsSync(path.join(c, '.harness')) && isHubCheckout(c));
}

const notAttached = () => {
  console.log([
    'HUB_NOT_ATTACHED: no checkout of the harness hub was found next to this project.',
    '---',
    'Needed from you:',
    `1. Step 1: In Claude Code on the web, open this session's repository picker (the repo chip above the prompt box) -> Step 2: Add "${hub.owner ? `${hub.owner}/` : ''}${hub.repo}" and start a new session with both repos attached, then re-run the command.`,
    `   Last resort (only if attaching is impossible): in your own Terminal run \`git clone https://github.com/${hub.owner || '<owner>'}/${hub.repo} /tmp/${hub.repo}\` and re-run with HARNESS_HUB_DIR=/tmp/${hub.repo}.`,
  ].join('\n'));
};

// Merge the spoke's settings: hub hooks win, permissions are unioned, hub deny beats spoke allow.
function syncSettings(hubRoot, extrasFile) {
  const hubSettings = readJson(path.join(hubRoot, '.claude', 'settings.json'));
  if (!hubSettings) return 'hub settings missing';
  const spokeFile = path.join(root, '.claude', 'settings.json');
  const spokeSettings = readJson(spokeFile) || {};
  // Keep any spoke-only permissions in their own file, so a later pull cannot erase them
  const extras = readJson(extrasFile) || {};
  const found = spokeOnlyPermissions(spokeSettings, hubSettings);
  const merged = {
    allow: [...new Set([...(extras.permissions?.allow || []), ...found.allow])],
    deny: [...new Set([...(extras.permissions?.deny || []), ...found.deny])],
  };
  if (merged.allow.length || merged.deny.length) {
    fs.mkdirSync(path.dirname(extrasFile), { recursive: true });
    fs.writeFileSync(extrasFile, JSON.stringify({ permissions: merged }, null, 2) + '\n', 'utf8');
  }
  const next = mergeSettings(hubSettings, spokeSettings, merged);
  fs.mkdirSync(path.dirname(spokeFile), { recursive: true });
  fs.writeFileSync(spokeFile, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return `${merged.allow.length + merged.deny.length} spoke-only permission(s) kept`;
}

// Pull every hub-owned file. Returns a receipt object; never throws on a single file conflict.
function pullFromHub(hubRoot) {
  const manifest = readManifest(root);
  const migrating = manifest === null;
  const previous = manifest?.files || {};
  const hubFiles = listHubOwned(hubRoot);
  const hubSet = new Set(hubFiles);
  const files = {};
  const receipt = { written: [], conflicts: [], deleted: [], backedUp: [], notes: [] };
  const backupDir = path.join(root, '.harness-backup', new Date().toISOString().replace(/[:.]/g, '-'));

  // First sync on a spoke with no manifest: keep spoke learned rules, back up anything that differs
  if (migrating) {
    const spokeRules = readText(path.join(root, '.claude', 'harness-rules.md'));
    const hubRules = readText(path.join(hubRoot, '.claude', 'harness-rules.md'));
    const keep = learnedRulesToKeep(spokeRules, hubRules);
    if (keep.length) {
      const projectRulesPath = path.join(root, PROJECT_RULES);
      fs.mkdirSync(path.dirname(projectRulesPath), { recursive: true });
      fs.writeFileSync(projectRulesPath, appendActiveRules(readText(projectRulesPath), keep), 'utf8');
      receipt.notes.push(`moved ${keep.length} learned rule(s) from harness-rules.md to ${PROJECT_RULES}`);
    }
  }

  for (const rel of hubFiles) {
    const src = path.join(hubRoot, rel);
    const dest = path.join(root, rel);
    const hubBuf = fs.readFileSync(src);
    const hubHash = sha256(hubBuf);
    const exists = fs.existsSync(dest);
    const localHash = exists ? sha256(fs.readFileSync(dest)) : null;

    if (exists && localHash === hubHash) { files[rel] = hubHash; continue; }

    if (exists && !migrating && localHash !== previous[rel]) {
      // The spoke edited this file, or it was never synced: keep the spoke copy and report it
      // Keep the last hash we wrote, so the file stays a conflict until someone resolves it
      if (previous[rel] !== undefined) files[rel] = previous[rel];
      receipt.conflicts.push(rel);
      continue;
    }
    if (exists && migrating) {
      fs.mkdirSync(path.join(backupDir, path.dirname(rel)), { recursive: true });
      fs.copyFileSync(dest, path.join(backupDir, rel));
      receipt.backedUp.push(rel);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, hubBuf);
    files[rel] = hubHash;
    receipt.written.push(rel);
  }

  // Files the hub removed: delete only if the spoke copy is still exactly what we last wrote
  for (const rel of Object.keys(previous)) {
    if (hubSet.has(rel)) continue;
    const dest = path.join(root, rel);
    if (!fs.existsSync(dest)) continue;
    if (sha256(fs.readFileSync(dest)) === previous[rel]) {
      fs.rmSync(dest, { force: true });
      receipt.deleted.push(rel);
    } else {
      files[rel] = previous[rel];
      receipt.conflicts.push(`${rel} (removed in hub, but edited here)`);
    }
  }

  // Merged files: only the marked block (or the permission lists) is the hub's
  const hubGitignore = readText(path.join(hubRoot, '.harness', 'templates', 'gitignore.block'));
  const gitignorePath = path.join(root, '.gitignore');
  fs.writeFileSync(gitignorePath, mergeBlock(readText(gitignorePath), hubGitignore, GITIGNORE_MARKERS), 'utf8');
  const hubAgents = readText(path.join(hubRoot, '.harness', 'templates', 'AGENTS.block.md'));
  const agentsPath = path.join(root, 'AGENTS.md');
  fs.writeFileSync(agentsPath, mergeBlock(readText(agentsPath), hubAgents, AGENTS_MARKERS), 'utf8');
  receipt.notes.push(syncSettings(hubRoot, path.join(root, SETTINGS_SPOKE)));

  // Templates the spoke may customise: copied once, never overwritten
  for (const rel of TEMPLATE_ONLY) {
    const src = path.join(hubRoot, rel);
    const dest = path.join(root, rel);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      receipt.written.push(`${rel} (template, first copy)`);
    }
  }

  // Keep the old hash for conflicted files so they stay conflicted until resolved
  writeManifest(root, files, readText(path.join(root, '.harness-version'), '').trim() || 'unknown');
  return { receipt, migrating };
}

function describe(hubRoot, { receipt, migrating }) {
  const version = readText(path.join(root, '.harness-version'), '').trim() || 'unknown';
  const lines = [`✓ Pulled hub-owned files from ${path.relative(root, hubRoot) || hubRoot} (harness v${version}).`];
  if (migrating) lines.push('First sync on this project: manifest created.');
  if (receipt.written.length) lines.push(`Updated ${receipt.written.length}: ${receipt.written.join(', ')}`);
  if (receipt.deleted.length) lines.push(`Removed ${receipt.deleted.length} file(s) the hub deleted: ${receipt.deleted.join(', ')}`);
  if (receipt.backedUp.length) lines.push(`Backed up ${receipt.backedUp.length} differing file(s) to .harness-backup/: ${receipt.backedUp.join(', ')}`);
  if (receipt.conflicts.length) lines.push(`⚠ Not overwritten (edited here or never synced): ${receipt.conflicts.join(', ')}. Review them, then delete the local copy to take the hub version.`);
  for (const note of receipt.notes) lines.push(`- ${note}`);
  lines.push('Spoke-owned files (CLAUDE.md, .spec/ except templates, project-rules.md) were not touched.');
  console.log(lines.join('\n'));
}

// init: create the spoke skeleton where files are missing, then pull the engine
function init(hubRoot) {
  fs.mkdirSync(root, { recursive: true });
  const skeleton = path.join(hubRoot, '.harness', 'templates', 'spoke');
  const created = [];
  const place = (rel, from) => {
    const dest = path.join(root, rel);
    if (fs.existsSync(dest)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(from, dest);
    created.push(rel);
  };
  place('CLAUDE.md', path.join(skeleton, 'CLAUDE.md'));
  place('.claude/project-rules.md', path.join(skeleton, 'project-rules.md'));
  for (const name of ['PROGRESS.md', 'SYSTEM_SPEC.md', 'OVERVIEW.md', 'DECISIONS.md', 'SESSION_HANDOFF.md']) {
    place(`.spec/${name}`, path.join(skeleton, name));
  }
  place('.spec/harness.json', path.join(skeleton, 'harness.json'));
  if (!fs.existsSync(path.join(root, '.harness-version'))) {
    fs.copyFileSync(path.join(hubRoot, '.harness-version'), path.join(root, '.harness-version'));
  }
  return created;
}

if (action === 'push') {
  // push: add the learned rule to the hub's rules file on a fresh claude/learn-* branch, then push it
  const sibling = findSibling();
  if (!sibling) {
    console.log('✓ Local rule saved to .claude/harness-rules.md (not synced to hub).');
    notAttached();
    process.exit(0);
  }
  const slug = note.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'rule';
  const branch = `claude/learn-${slug}-${Date.now().toString(36)}`;
  try {
    if (gitIn(sibling, 'status', '--porcelain')) throw new Error(`hub checkout ${sibling} has uncommitted changes; commit or stash them first`);
    let base = hub.branch;
    try { gitIn(sibling, 'fetch', 'origin', hub.branch); base = `origin/${hub.branch}`; } catch {}
    gitIn(sibling, 'checkout', '-b', branch, base);
    const rulesPath = path.join(sibling, '.claude', 'harness-rules.md');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    const line = `- ${note}`;
    if (!rules.includes(line)) {
      const header = '## Learned Operator Rules';
      const next = rules.includes(header) ? rules.replace(/\s*$/, `\n${line}\n`) : `${rules.trimEnd()}\n\n${header} (Synced via \`/learn\`)\n${line}\n`;
      fs.writeFileSync(rulesPath, next);
    }
    gitIn(sibling, 'add', '--', '.claude/harness-rules.md');
    gitIn(sibling, 'commit', '-m', `chore(harness): learn "${note}"`);
    gitIn(sibling, 'push', '-u', 'origin', branch);
    console.log(`HUB_BRANCH_PUSHED repo=${hub.owner ? `${hub.owner}/` : ''}${hub.repo} branch=${branch} base=${hub.branch}: open a PR for this branch via GitHub MCP, then report "PR opened".`);
  } catch (err) {
    console.log(`✓ Local rule saved to .claude/harness-rules.md, but the hub push failed. Git said: ${reason(err)}`);
  }
  process.exit(0);
}

const sibling = findSibling();
if (!sibling) {
  if (action === 'init') {
    console.log('✗ init needs the hub checkout next to the target. Attach the hub repo, or set HARNESS_HUB_DIR, then re-run.');
  } else {
    notAttached();
  }
  process.exit(0);
}

if (action === 'init') {
  const created = init(sibling);
  console.log(`✓ Created ${created.length} starter file(s): ${created.join(', ') || 'none (all existed)'}. Spoke mode set to manager in .spec/harness.json.`);
}
try { gitIn(sibling, 'pull', '--ff-only', '--quiet'); } catch {} // best effort; offline copy still works
describe(sibling, pullFromHub(sibling));
