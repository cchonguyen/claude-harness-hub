import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentsBlock, bashWriteReason, colourOf, isEngineLocked, isHubOrigin, isProtectedPath, nextContent, sliceIdOf,
} from './guard-rules.mjs';

test('engine lock covers hub-owned files and leaves spoke files alone', () => {
  for (const f of ['.harness/hooks/pre-tool-guard.mjs', '.harness-version', '.claude/settings.json', '.claude/agents/engineer.md',
    '.claude/commands/implement.md', '.claude/harness-rules.md', '.spec/EXTERNAL_AGENT_RULES.md', '.spec/harness.json']) {
    assert.equal(isEngineLocked(f), true, f);
  }
  for (const f of ['.claude/project-rules.md', '.claude/settings.spoke.json', 'CLAUDE.md', '.spec/PROGRESS.md', 'src/app.js']) {
    assert.equal(isEngineLocked(f), false, f);
  }
});

test('the AGENTS.md block is the text between the markers, markers included', () => {
  const text = 'My notes\n<!-- >>> harness >>> -->\nrule\n<!-- <<< harness <<< -->\nmore\n';
  assert.equal(agentsBlock(text), '<!-- >>> harness >>> -->\nrule\n<!-- <<< harness <<< -->');
  assert.equal(agentsBlock('no block here'), '');
});

test('colour and slice identity are read from a slice line', () => {
  const line = '- [ ] **Slice 3.3** [IN_PROGRESS] `[YELLOW][CORE / DATA]`: guard';
  assert.equal(colourOf(line), 'YELLOW');
  assert.equal(sliceIdOf(line), '3.3');
  assert.equal(colourOf('- [ ] **Slice 1** `[CORE / DATA]`'), null);
});

test('nextContent applies Write and Edit, including "$&" in replacement text', () => {
  assert.equal(nextContent('a b', 'Write', { content: 'new' }), 'new');
  assert.equal(nextContent('a b', 'Edit', { old_string: 'a', new_string: '$&$&' }), '$&$& b');
  assert.equal(nextContent('a a', 'Edit', { old_string: 'a', new_string: 'x', replace_all: true }), 'x x');
});

test('a Bash redirect into a protected path is caught, a redirect elsewhere is not', () => {
  assert.match(bashWriteReason('echo hi > .harness/hooks/x.mjs'), /redirects output into \.harness\/hooks\/x\.mjs/);
  assert.match(bashWriteReason('echo hi >> .claude/settings.json'), /settings\.json/);
  assert.equal(bashWriteReason('cat .harness/hooks/x.mjs > /tmp/out.txt'), null);
  assert.equal(bashWriteReason('npm test 2>&1 | tail -5'), null);
});

test('write verbs that name a protected path are caught', () => {
  assert.match(bashWriteReason('sed -i s/a/b/ AGENTS.md'), /sed/);
  assert.match(bashWriteReason('git checkout -- .claude/agents/engineer.md'), /git checkout/);
  assert.match(bashWriteReason('rm .harness-version'), /rm/);
});

test('reads and the harness restore command are not blocked', () => {
  assert.equal(bashWriteReason('ls .harness'), null);
  assert.equal(bashWriteReason('node .harness/hooks/pre-tool-guard.mjs --restore'), null);
  assert.equal(bashWriteReason('cp src/a.js src/b.js'), null);
});

test('protected path rule', () => {
  assert.equal(isProtectedPath('./.harness/x.mjs'), true);
  assert.equal(isProtectedPath('AGENTS.md'), true);
  assert.equal(isProtectedPath('.claude/project-rules.md'), false);
});

test('hub detection uses the origin URL only', () => {
  assert.equal(isHubOrigin('https://github.com/cchonguyen/claude-harness-hub.git'), true);
  assert.equal(isHubOrigin('git@github.com:cchonguyen/claude-harness-hub'), true);
  assert.equal(isHubOrigin('https://github.com/cchonguyen/charliechonguyen.com'), false);
  assert.equal(isHubOrigin(''), false);
});

test('sliceIdOf falls back to the trimmed line when there is no Slice label', () => {
  assert.equal(sliceIdOf('  plain line  '), 'plain line');
});
