import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncAgents, pullFromHub } from './hub-sync.mjs';

function makeTempDir(prefix = 'hub-sync-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('syncAgents synchronizes all agent templates from .harness/agents to .claude/agents and .agents', () => {
  const root = makeTempDir();
  const harnessAgents = path.join(root, '.harness', 'agents');
  fs.mkdirSync(harnessAgents, { recursive: true });

  fs.writeFileSync(path.join(harnessAgents, 'elephant.md'), '# Elephant Agent\n');
  fs.writeFileSync(path.join(harnessAgents, 'goldfish-coder.md'), '# Goldfish Coder\n');

  const synced = syncAgents(root);
  assert.equal(synced.length, 4);
  assert.ok(synced.includes('.claude/agents/elephant.md'));
  assert.ok(synced.includes('.claude/agents/goldfish-coder.md'));
  assert.ok(synced.includes('.agents/elephant.md'));
  assert.ok(synced.includes('.agents/goldfish-coder.md'));

  assert.equal(fs.readFileSync(path.join(root, '.claude', 'agents', 'elephant.md'), 'utf8'), '# Elephant Agent\n');
  assert.equal(fs.readFileSync(path.join(root, '.agents', 'elephant.md'), 'utf8'), '# Elephant Agent\n');

  fs.rmSync(root, { recursive: true, force: true });
});

test('syncAgents is idempotent and returns empty array when files match', () => {
  const root = makeTempDir();
  const harnessAgents = path.join(root, '.harness', 'agents');
  fs.mkdirSync(harnessAgents, { recursive: true });
  fs.writeFileSync(path.join(harnessAgents, 'goldfish-verifier.md'), '# Goldfish Verifier\n');

  const firstSync = syncAgents(root);
  assert.equal(firstSync.length, 2);

  const secondSync = syncAgents(root);
  assert.deepEqual(secondSync, []);

  fs.rmSync(root, { recursive: true, force: true });
});

test('syncAgents updates target files when template content changes', () => {
  const root = makeTempDir();
  const harnessAgents = path.join(root, '.harness', 'agents');
  fs.mkdirSync(harnessAgents, { recursive: true });
  fs.writeFileSync(path.join(harnessAgents, 'librarian.md'), 'v1');

  syncAgents(root);

  fs.writeFileSync(path.join(harnessAgents, 'librarian.md'), 'v2');
  const updateSync = syncAgents(root);
  assert.equal(updateSync.length, 2);
  assert.equal(fs.readFileSync(path.join(root, '.claude', 'agents', 'librarian.md'), 'utf8'), 'v2');
  assert.equal(fs.readFileSync(path.join(root, '.agents', 'librarian.md'), 'utf8'), 'v2');

  fs.rmSync(root, { recursive: true, force: true });
});

test('syncAgents respects custom target directories passed as argument', () => {
  const root = makeTempDir();
  const harnessAgents = path.join(root, '.harness', 'agents');
  fs.mkdirSync(harnessAgents, { recursive: true });
  fs.writeFileSync(path.join(harnessAgents, 'git-clerk.md'), '# Clerk\n');

  const synced = syncAgents(root, ['.custom/agents']);
  assert.deepEqual(synced, ['.custom/agents/git-clerk.md']);
  assert.ok(fs.existsSync(path.join(root, '.custom', 'agents', 'git-clerk.md')));
  assert.ok(!fs.existsSync(path.join(root, '.claude', 'agents', 'git-clerk.md')));

  fs.rmSync(root, { recursive: true, force: true });
});

test('syncAgents respects agent_sync_dirs configured in thresholds.json', () => {
  const root = makeTempDir();
  const harnessAgents = path.join(root, '.harness', 'agents');
  fs.mkdirSync(harnessAgents, { recursive: true });
  fs.writeFileSync(path.join(harnessAgents, 'elephant.md'), '# Elephant\n');

  const configDir = path.join(root, '.harness', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'thresholds.json'),
    JSON.stringify({ agent_sync_dirs: ['.configured/agents'] }),
    'utf8'
  );

  const synced = syncAgents(root);
  assert.deepEqual(synced, ['.configured/agents/elephant.md']);
  assert.ok(fs.existsSync(path.join(root, '.configured', 'agents', 'elephant.md')));
  assert.ok(!fs.existsSync(path.join(root, '.claude', 'agents', 'elephant.md')));

  fs.rmSync(root, { recursive: true, force: true });
});

test('pullFromHub pulls .harness/agents and synchronizes into .claude/agents and .agents', () => {
  const hubRoot = makeTempDir('hub-');
  const spokeRoot = makeTempDir('spoke-');

  // Set up hub skeleton
  const hubAgentsDir = path.join(hubRoot, '.harness', 'agents');
  fs.mkdirSync(hubAgentsDir, { recursive: true });
  fs.writeFileSync(path.join(hubAgentsDir, 'elephant.md'), '# Elephant Template\n');
  fs.writeFileSync(path.join(hubAgentsDir, 'goldfish-coder.md'), '# Goldfish Template\n');

  const hubTemplates = path.join(hubRoot, '.harness', 'templates');
  fs.mkdirSync(hubTemplates, { recursive: true });
  fs.writeFileSync(path.join(hubTemplates, 'gitignore.block'), '# gitignore block\n');
  fs.writeFileSync(path.join(hubTemplates, 'AGENTS.block.md'), '## Card Catalog block\n');

  const hubClaude = path.join(hubRoot, '.claude');
  fs.mkdirSync(hubClaude, { recursive: true });
  fs.writeFileSync(path.join(hubClaude, 'settings.json'), JSON.stringify({ permissions: { allow: [], deny: [] } }));

  fs.writeFileSync(path.join(hubRoot, '.harness-version'), '4.0.0\n');

  // Spoke pre-existing files
  fs.writeFileSync(path.join(spokeRoot, '.gitignore'), '# user gitignore\n');
  fs.writeFileSync(path.join(spokeRoot, 'AGENTS.md'), '# Spoke AGENTS\n');

  const result = pullFromHub(hubRoot, spokeRoot);
  assert.ok(result.receipt.written.length > 0);

  // Assert spoke received the files
  assert.ok(fs.existsSync(path.join(spokeRoot, '.harness', 'agents', 'elephant.md')));
  assert.ok(fs.existsSync(path.join(spokeRoot, '.claude', 'agents', 'elephant.md')));
  assert.ok(fs.existsSync(path.join(spokeRoot, '.agents', 'elephant.md')));
  assert.ok(fs.existsSync(path.join(spokeRoot, '.claude', 'agents', 'goldfish-coder.md')));
  assert.ok(fs.existsSync(path.join(spokeRoot, '.agents', 'goldfish-coder.md')));

  // Assert AGENTS.md was merged with markers
  const agentsContent = fs.readFileSync(path.join(spokeRoot, 'AGENTS.md'), 'utf8');
  assert.match(agentsContent, /<!-- >>> harness >>> -->/);
  assert.match(agentsContent, /## Card Catalog block/);
  assert.match(agentsContent, /<!-- <<< harness <<< -->/);

  fs.rmSync(hubRoot, { recursive: true, force: true });
  fs.rmSync(spokeRoot, { recursive: true, force: true });
});
