/**
 * dashboard/lib/snapshot.test.mjs
 * node:test, no network. fetchImpl is faked.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildSnapshot,
  snapshotMarkdownFreshness,
  writeSnapshotFile,
} from './snapshot.mjs';

const REPO = 'o/r';
const TOKEN = 'ghp_secret123';
const NOW = new Date('2026-11-05T12:00:00Z');

const PROGRESS = [
  '# Progress',
  '- [x] **Slice 9.1: Foo** Merged: PR #11 by alice.',
  '- [ ] **Slice 9.2b: Snapshot** [IN_PROGRESS]',
  '',
].join('\n');

const PULLS = [
  {
    number: 11,
    title: 'Slice 9.1: Foo',
    state: 'closed',
    merged_at: '2026-11-01T00:00:00Z',
    merged_by: { login: 'alice' },
    head: { ref: 'claude/slice-9.1', sha: 's11' },
    html_url: 'https://example.test/11',
  },
  {
    number: 12,
    title: 'Slice 9.2b: Snapshot',
    state: 'open',
    merged_at: null,
    merged_by: null,
    head: { ref: 'claude/slice-9.2b', sha: 's12' },
    html_url: 'https://example.test/12',
  },
  {
    number: 10,
    title: 'Old work',
    state: 'closed',
    merged_at: '2026-10-01T00:00:00Z',
    merged_by: { login: 'bob' },
    head: { ref: 'claude/old', sha: 's10' },
    html_url: 'https://example.test/10',
  },
];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Fake GitHub: records every requested path. */
function fakeGitHub(calls) {
  return async (url) => {
    const u = new URL(url);
    calls.push(u.pathname + u.search);
    if (u.pathname === `/repos/${REPO}/pulls`) return jsonResponse(PULLS);
    if (u.pathname === `/repos/${REPO}/commits/s11/check-runs`) {
      return jsonResponse({ check_runs: [{ name: 'verify', status: 'completed', conclusion: 'success' }] });
    }
    if (u.pathname === `/repos/${REPO}/commits/s12/check-runs`) {
      return jsonResponse({ check_runs: [{ name: 'verify', status: 'in_progress', conclusion: null }] });
    }
    return jsonResponse({ message: 'not found' }, 404);
  };
}

test('buildSnapshot returns ok:false when origin/main PROGRESS.md is unreadable', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'snapshot-nogit-'));
  try {
    const calls = [];
    const snap = await buildSnapshot({
      repo: REPO,
      cwd,
      token: TOKEN,
      now: NOW,
      fetchImpl: fakeGitHub(calls),
      readProgress: () => null,
    });
    assert.equal(snap.ok, false);
    assert.equal(snap.error, 'origin/main PROGRESS.md unreadable');
    assert.equal(typeof snap.fetchedAt, 'string');
    assert.equal(calls.length, 0, 'no GitHub calls when progress is unreadable');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('buildSnapshot with fake GitHub returns ok:true, merged slice with merger', async () => {
  const calls = [];
  const snap = await buildSnapshot({
    repo: REPO,
    cwd: '/unused',
    token: TOKEN,
    now: NOW,
    fetchImpl: fakeGitHub(calls),
    readProgress: () => ({ text: PROGRESS, sha: 'abc123' }),
  });

  assert.equal(snap.ok, true);
  assert.equal(snap.schema, 1);
  assert.equal(snap.repo, REPO);
  assert.equal(snap.fetchedAt, NOW.toISOString());
  assert.equal(snap.source.progressRef, 'origin/main');
  assert.equal(snap.source.progressSha, 'abc123');
  assert.equal(typeof snap.source.prsFetchedAt, 'string');

  const merged = snap.state.slices.find((s) => s.id === '9.1');
  assert.ok(merged, 'slice 9.1 present');
  assert.equal(merged.status, 'merged');
  assert.equal(merged.mergedBy, 'alice');

  const inProgress = snap.state.slices.find((s) => s.id === '9.2b');
  assert.ok(inProgress, 'slice 9.2b present');
  assert.equal(inProgress.checks.length, 1);

  // Check runs: open PR and recently merged PR only. Old merge (s10) is skipped.
  assert.ok(calls.some((c) => c.includes('/commits/s12/check-runs')));
  assert.ok(calls.some((c) => c.includes('/commits/s11/check-runs')));
  assert.ok(!calls.some((c) => c.includes('/commits/s10/check-runs')));
});

test('buildSnapshot turns a GitHub 500 into ok:false without the token', async () => {
  const snap = await buildSnapshot({
    repo: REPO,
    cwd: '/unused',
    token: TOKEN,
    now: NOW,
    fetchImpl: async () => new Response('boom', { status: 500 }),
    readProgress: () => ({ text: PROGRESS, sha: 'abc123' }),
  });
  assert.equal(snap.ok, false);
  assert.equal(typeof snap.error, 'string');
  assert.match(snap.error, /500/);
  assert.equal(snap.error.includes(TOKEN), false);
  assert.equal(JSON.stringify(snap).includes(TOKEN), false);
});

test('writeSnapshotFile writes valid JSON and leaves no .tmp file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-write-'));
  try {
    const out = join(dir, 'nested', 'site', 'status.json');
    const data = { ok: true, schema: 1, fetchedAt: NOW.toISOString() };
    writeSnapshotFile(data, out);

    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), data);
    const leftovers = readdirSync(join(dir, 'nested', 'site'));
    assert.deepEqual(leftovers, ['status.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('snapshotMarkdownFreshness reports age in minutes or unknown', () => {
  assert.equal(
    snapshotMarkdownFreshness({ fetchedAt: '2026-11-05T11:57:00Z' }, NOW),
    'snapshot 3m old',
  );
  assert.equal(snapshotMarkdownFreshness({}, NOW), 'snapshot age unknown');
});
