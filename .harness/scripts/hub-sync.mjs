#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// execFileSync passes arguments without a shell, so quotes, $ and backticks in a rule are inert
const gitIn = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitRoot = () => { try { return gitIn(process.cwd(), 'rev-parse', '--show-toplevel'); } catch { return ''; } };

const root = process.env.CLAUDE_PROJECT_DIR || gitRoot() || process.cwd();
const action = (process.argv[2] || 'pull').toLowerCase();
const stagingFile = path.join(root, '.spec', '.learn-staging.txt');
const ENGINE_PATHS = ['.claude', '.harness', '.harness-version'];
// Spoke-owned templates: copied only when the spoke does not have the file yet, so local edits survive a sync
const TEMPLATE_PATHS = ['.spec/AI_STUDIO_RULES.md'];
const hub = (() => {
  try { return { repo: 'claude-harness-hub', branch: 'main', ...JSON.parse(fs.readFileSync(path.join(root, '.harness', 'hub.json'), 'utf8')) }; } catch { return { repo: 'claude-harness-hub', branch: 'main' }; }
})();
const reason = (err) => String(err.stderr || err.stdout || err.message).trim().split('\n')[0];

if (action !== 'pull' && action !== 'push') {
  console.log(`✗ Unknown action "${action}". Use pull or push.`);
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

// Running inside the hub repo itself: commit engine files on the current branch, as before
if (isHubCheckout(root)) {
  if (action === 'pull') {
    console.log(`✓ This is the ${hub.repo} repo itself; engine files are already the source of truth.`);
  } else {
    try {
      gitIn(root, 'add', '--', ...ENGINE_PATHS);
      gitIn(root, 'commit', '-m', `chore(harness): ${note}`, '--', ...ENGINE_PATHS);
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
const sibling = findSibling();

const notAttached = () => {
  console.log([
    'HUB_NOT_ATTACHED: no checkout of the harness hub was found next to this project.',
    '---',
    'Needed from you:',
    `1. Step 1: In Claude Code on the web, open this session's repository picker (the repo chip above the prompt box) -> Step 2: Add "${hub.owner ? `${hub.owner}/` : ''}${hub.repo}" and start a new session with both repos attached, then re-run the command.`,
    `   Last resort (only if attaching is impossible): in your own Terminal run \`git clone https://github.com/${hub.owner || '<owner>'}/${hub.repo} /tmp/${hub.repo}\` and re-run with HARNESS_HUB_DIR=/tmp/${hub.repo}.`
  ].join('\n'));
};

const copyEngine = (from, to) => {
  for (const rel of ENGINE_PATHS) {
    const src = path.join(from, rel);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(to, rel), { recursive: true, force: true });
  }
};

const copyTemplatesIfMissing = (from, to) => {
  for (const rel of TEMPLATE_PATHS) {
    const src = path.join(from, rel);
    const dest = path.join(to, rel);
    if (!fs.existsSync(src) || fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest);
  }
};

if (action === 'pull') {
  if (sibling) {
    try { gitIn(sibling, 'pull', '--ff-only', '--quiet'); } catch {} // best effort; offline copy still works
    copyEngine(sibling, root);
    copyTemplatesIfMissing(sibling, root);
    const version = fs.readFileSync(path.join(root, '.harness-version'), 'utf8').trim();
    console.log(`✓ Pulled .claude/ and .harness/ engine files from ${path.relative(root, sibling) || sibling} (harness v${version}). CLAUDE.md and .spec/ untouched, except any missing template files, which were added.`);
    process.exit(0);
  }
  // Fallback: an explicit harness-hub git remote
  let remotes = [];
  try { remotes = gitIn(root, 'remote').split('\n'); } catch {}
  if (!remotes.includes('harness-hub')) { notAttached(); process.exit(0); }
  try {
    gitIn(root, 'fetch', 'harness-hub', hub.branch);
    const missingTemplates = TEMPLATE_PATHS.filter((rel) => !fs.existsSync(path.join(root, rel)));
    gitIn(root, 'checkout', `harness-hub/${hub.branch}`, '--', ...ENGINE_PATHS, ...missingTemplates);
    console.log(`✓ Pulled latest engine files from harness-hub/${hub.branch}.`);
  } catch (err) {
    console.log(`✗ Pull failed, local harness files unchanged. Git said: ${reason(err)}`);
  }
  process.exit(0);
}

// push: add the learned rule to the hub's rules file on a fresh claude/learn-* branch, then push it
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
