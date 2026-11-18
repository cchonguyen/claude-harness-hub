import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stopDecision, hasInProgressSlice, unwatchedPrs } from '../stop-guard.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'stop-guard.mjs');

const makeRoot = (progress) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stop-guard-'));
  if (progress !== undefined) {
    fs.mkdirSync(path.join(root, '.spec'), { recursive: true });
    fs.writeFileSync(path.join(root, '.spec', 'PROGRESS.md'), progress);
  }
  return root;
};

const IN_PROGRESS = '- [ ] **Slice 1: Demo** [IN_PROGRESS] [CORE / DATA] Target files: a.mjs\n';
const DONE_ONLY = '- [x] **Slice 1: Demo** [CORE / DATA] Target files: a.mjs\n';

test('hasInProgressSlice detects an [IN_PROGRESS] slice line only, not pending boxes', () => {
  assert.equal(hasInProgressSlice(IN_PROGRESS), true);
  assert.equal(hasInProgressSlice('- [ ] **Slice 2: Next** Target files: b.mjs\n'), false);
  assert.equal(hasInProgressSlice(DONE_ONLY), false);
  assert.equal(hasInProgressSlice(''), false);
});

test('pending-only slices (unchecked boxes, no IN_PROGRESS) allow stop', () => {
  const root = makeRoot('- [x] **Slice 1: Done** [CORE / DATA] Target files: a.mjs\n- [ ] **Slice 2: Next** [CORE / DATA] Target files: b.mjs\n');
  try {
    assert.equal(stopDecision({ root, env: {} }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('no IN_PROGRESS slice allows stop', () => {
  const root = makeRoot(DONE_ONLY);
  try {
    assert.equal(stopDecision({ root, env: {} }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing PROGRESS.md allows stop', () => {
  const root = makeRoot();
  try {
    assert.equal(stopDecision({ root, env: {} }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('IN_PROGRESS slice with no escape blocks stop', () => {
  const root = makeRoot(IN_PROGRESS);
  try {
    const reason = stopDecision({ root, env: {} });
    assert.ok(reason.length > 0);
    assert.match(reason, /Slice 1 is still \[IN_PROGRESS\]/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('IN_PROGRESS slice with the wake escape allows stop', () => {
  const root = makeRoot(IN_PROGRESS);
  try {
    assert.equal(stopDecision({ root, env: { CLAUDE_WAKE_SCHEDULED: '1' } }), '');
    assert.equal(stopDecision({ root, env: { CLAUDE_PR_SUBSCRIBED: '1' } }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stop_hook_active allows stop so the hook cannot loop', () => {
  const root = makeRoot(IN_PROGRESS);
  try {
    assert.equal(stopDecision({ root, env: {}, payload: { stop_hook_active: true } }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('malformed stdin does not throw and allows stop', () => {
  const root = makeRoot(IN_PROGRESS);
  try {
    const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
    delete env.CLAUDE_WAKE_SCHEDULED;
    delete env.CLAUDE_PR_SUBSCRIBED;
    const res = spawnSync(process.execPath, [HOOK], { input: '{not json', encoding: 'utf8', env });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('blocking run emits a Stop block decision on stdout', () => {
  const root = makeRoot(IN_PROGRESS);
  try {
    const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
    delete env.CLAUDE_WAKE_SCHEDULED;
    delete env.CLAUDE_PR_SUBSCRIBED;
    const res = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ cwd: root }), encoding: 'utf8', env });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, 'block');
    assert.ok(out.reason.length > 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Transcript helpers for slice 19.196 (JSONL, same shape as Claude Code session transcripts).
const toolUse = (id, name, input = {}) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } });
const toolResult = (id, content) => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } });
const openPr = (id, n) => [toolUse(id, 'mcp__github__create_pull_request'), toolResult(id, [{ type: 'text', text: `https://github.com/acme/app/pull/${n}` }])];
const transcript = (...lines) => lines.join('\n') + '\n';

test('unwatchedPrs: opened and never watched returns the PR number', () => {
  assert.deepEqual(unwatchedPrs(transcript(...openPr('a', 7))), [7]);
});

test('unwatchedPrs: opened then subscribed to activity returns nothing', () => {
  const text = transcript(...openPr('a', 7), toolUse('b', 'mcp__github__subscribe_pr_activity', { pullNumber: 7 }));
  assert.deepEqual(unwatchedPrs(text), []);
});

test('unwatchedPrs: opened then merged returns nothing', () => {
  const text = transcript(...openPr('a', 7), toolUse('b', 'mcp__github__merge_pull_request', { pullNumber: 7 }));
  assert.deepEqual(unwatchedPrs(text), []);
});

test('unwatchedPrs: opened then send_later returns nothing', () => {
  const text = transcript(...openPr('a', 7), toolUse('b', 'send_later', { delaySeconds: 300 }));
  assert.deepEqual(unwatchedPrs(text), []);
});

test('unwatchedPrs: send_later before opening does not count', () => {
  const text = transcript(toolUse('b', 'send_later', {}), ...openPr('a', 7));
  assert.deepEqual(unwatchedPrs(text), [7]);
});

test('unwatchedPrs: garbage lines return an empty list and do not throw', () => {
  assert.deepEqual(unwatchedPrs('{not json\n\nnull\n[1,2\n'), []);
  assert.deepEqual(unwatchedPrs(''), []);
  assert.deepEqual(unwatchedPrs(undefined), []);
});

test('unwatchedPrs: string tool_result content and multiple PRs, sorted and unique', () => {
  const text = transcript(
    toolUse('a', 'create_pull_request'), toolResult('a', 'Opened https://github.com/acme/app/pull/9'),
    toolUse('b', 'create_pull_request'), toolResult('b', 'Opened https://github.com/acme/app/pull/3'),
    toolUse('c', 'subscribe_pr_activity', { pullNumber: 9 }),
  );
  assert.deepEqual(unwatchedPrs(text), [3]);
});

test('stopDecision: unwatched PR with no in-progress slice blocks and names the PR', () => {
  const root = makeRoot(DONE_ONLY);
  const transcriptPath = path.join(root, 'session.jsonl');
  fs.writeFileSync(transcriptPath, transcript(...openPr('a', 42)));
  try {
    const reason = stopDecision({ root, env: {}, payload: { transcript_path: transcriptPath } });
    assert.match(reason, /PR #42 was opened in this session/);
    assert.match(reason, /subscribe_pr_activity/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stopDecision: stop_hook_active allows stop even with an unwatched PR', () => {
  const root = makeRoot(DONE_ONLY);
  const transcriptPath = path.join(root, 'session.jsonl');
  fs.writeFileSync(transcriptPath, transcript(...openPr('a', 42)));
  try {
    assert.equal(stopDecision({ root, env: {}, payload: { stop_hook_active: true, transcript_path: transcriptPath } }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stopDecision: watched PR allows stop', () => {
  const root = makeRoot(DONE_ONLY);
  const transcriptPath = path.join(root, 'session.jsonl');
  fs.writeFileSync(transcriptPath, transcript(...openPr('a', 42), toolUse('b', 'subscribe_pr_activity', { pullNumber: 42 })));
  try {
    assert.equal(stopDecision({ root, env: {}, payload: { transcript_path: transcriptPath } }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stopDecision: PR block respects the wake and PR-subscribed escapes', () => {
  const root = makeRoot(DONE_ONLY);
  const transcriptPath = path.join(root, 'session.jsonl');
  fs.writeFileSync(transcriptPath, transcript(...openPr('a', 42)));
  try {
    const payload = { transcript_path: transcriptPath };
    assert.equal(stopDecision({ root, env: { CLAUDE_WAKE_SCHEDULED: '1' }, payload }), '');
    assert.equal(stopDecision({ root, env: { CLAUDE_PR_SUBSCRIBED: '1' }, payload }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
