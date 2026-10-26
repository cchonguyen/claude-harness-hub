#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const action = (process.argv[2] || 'pull').toLowerCase();
const stagingFile = path.join(root, '.spec', '.learn-staging.txt');
const ENGINE_PATHS = ['.claude', '.harness', '.harness-version'];

// execFileSync passes arguments without a shell, so quotes, $ and backticks in a rule are inert
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

if (action !== 'pull' && action !== 'push') {
  console.log(`✗ Unknown action "${action}". Use pull or push.`);
  process.exit(0);
}

let note = 'Sync harness engine files';
if (action === 'push' && fs.existsSync(stagingFile)) {
  note = fs.readFileSync(stagingFile, 'utf8').trim().split('\n')[0] || note;
  fs.unlinkSync(stagingFile);
}

// Check if a git remote named 'harness-hub' or 'origin' (when inside the hub repo itself) is configured
let remotes = '';
try {
  remotes = git('remote');
} catch {
  console.log('NEEDED_SETUP: Git repository not initialized yet.');
  process.exit(0);
}

const hasHubRemote = remotes.split('\n').map((s) => s.trim()).includes('harness-hub');
const isHubRepoItself = ['claude-harness', 'claude-harness-hub'].includes(path.basename(root));
const remote = isHubRepoItself ? 'origin' : 'harness-hub';

if (!hasHubRemote && !isHubRepoItself) {
  const saved = action === 'push' ? '✓ Local rule saved to .claude/harness-rules.md. ' : '✗ Nothing pulled. ';
  console.log(`${saved}(Note: Remote hub sync is not connected yet. When your private claude-harness-hub GitHub repo is created, link it once via: git remote add harness-hub <repo-url>).`);
  process.exit(0);
}

if (action === 'pull') {
  try {
    git('fetch', remote, 'main');
    git('checkout', `${remote}/main`, '--', ...ENGINE_PATHS);
    const version = fs.readFileSync(path.join(root, '.harness-version'), 'utf8').trim();
    console.log(`✓ Pulled latest .claude/ and .harness/ engine files from ${remote}/main (harness v${version}).`);
  } catch (err) {
    const reason = String(err.stderr || err.message).trim().split('\n')[0];
    console.log(`✗ Pull failed, local harness files unchanged. Git said: ${reason}`);
  }
} else {
  try {
    git('add', '--', ...ENGINE_PATHS);
    // Pathspec limits the commit to engine files, so anything else the operator staged stays out
    git('commit', '-m', `chore(harness): ${note}`, '--', ...ENGINE_PATHS);
    console.log(`✓ Committed updated harness rules locally ("${note}"). Run git push when ready to publish to hub.`);
  } catch (err) {
    const reason = String(err.stdout || err.stderr || err.message).trim().split('\n')[0];
    console.log(`✓ Rule saved in .claude/harness-rules.md, but nothing was committed. Git said: ${reason}`);
  }
}
