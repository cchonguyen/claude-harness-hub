import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHubSync, analyze } from '../../scripts/pr-scope-check.mjs';

const managed = { files: { '.harness/config/thresholds.json': 'aaa', '.claude/agents/auditor.md': 'bbb' } };
const hashOf = (hashes) => (file) => hashes[file] ?? null;
const sync = (over = {}) => ({
  changed: ['.harness/managed.json', '.harness/config/thresholds.json'],
  deleted: [],
  managed,
  hashOf: hashOf({ '.harness/config/thresholds.json': 'aaa' }),
  ...over,
});

test('a hub sync with matching hashes passes', () => {
  assert.equal(isHubSync(sync()), true);
});

test('an engine file whose hash does not match its manifest entry is a hand edit', () => {
  assert.equal(isHubSync(sync({ hashOf: hashOf({ '.harness/config/thresholds.json': 'zzz' }) })), false);
});

test('an engine file missing from the manifest is not a sync', () => {
  assert.equal(isHubSync(sync({ changed: ['.harness/managed.json', '.claude/new.md'], hashOf: hashOf({ '.claude/new.md': 'x' }) })), false);
});

test('a sync without a managed.json change is not a sync', () => {
  assert.equal(isHubSync(sync({ changed: ['.harness/config/thresholds.json'] })), false);
});

test('deleting an engine file is never a sync', () => {
  assert.equal(isHubSync(sync({ deleted: ['.harness/hooks/vibe.mjs'] })), false);
});

test('a PR with no engine files is not a hub sync', () => {
  assert.equal(isHubSync({ changed: ['src/app.ts'], managed, hashOf }), false);
});

test('analyze: hub sync clears the strict engine-file problem', () => {
  const r = analyze({ changed: ['.harness/config/thresholds.json'], strict: true, hubSync: true });
  assert.deepEqual(r.problems, []);
});

test('analyze: a non-sync engine change still blocks in strict mode', () => {
  const r = analyze({ changed: ['.harness/config/thresholds.json'], strict: true, hubSync: false });
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /hub owns/);
});
