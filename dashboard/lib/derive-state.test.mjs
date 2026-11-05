import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveState } from './derive-state.mjs';
import { ghRequest, listPullRequests, checkRunsFor, tokenFromEnv } from './github.mjs';

const pr = (over = {}) => ({
  number: 1,
  title: 'Unrelated',
  state: 'open',
  merged: false,
  mergedBy: null,
  mergedAt: null,
  headRef: 'claude/other',
  headSha: 'sha1',
  htmlUrl: 'https://github.com/x/y/pull/1',
  ...over,
});

test('merged slice with PR gets status merged and its merger', () => {
  const progressText = '- [x] **Slice 9.1: Title** [CORE / DATA] Merged: PR #63 by cchonguyen. Target files: a.mjs\n';
  const prs = [pr({ number: 63, title: 'Slice 9.1: Title', state: 'closed', merged: true, mergedBy: 'cchonguyen', mergedAt: '2026-11-01T00:00:00Z' })];
  const s = deriveState({ progressText, prs, originSha: 'abc', fetchedAt: '2026-11-05T00:00:00Z' });
  assert.equal(s.slices.length, 1);
  assert.equal(s.slices[0].id, '9.1');
  assert.equal(s.slices[0].status, 'merged');
  assert.equal(s.slices[0].mergedBy, 'cchonguyen');
  assert.equal(s.slices[0].source, 'PROGRESS.md');
  assert.equal(s.slices[0].pr.number, 63);
});

test('PR merged while PROGRESS still open gives status merged with PR provenance', () => {
  const progressText = '- [ ] **Slice 9.4: Later** [CORE / DATA]\n';
  const prs = [pr({ number: 70, title: 'Slice 9.4: Later', state: 'closed', merged: true, mergedBy: 'alice' })];
  const s = deriveState({ progressText, prs });
  assert.equal(s.slices[0].status, 'merged');
  assert.equal(s.slices[0].source, 'PR #70');
  assert.equal(s.slices[0].mergedBy, 'alice');
});

test('IN_PROGRESS slice gets status in-progress', () => {
  const progressText = '- [ ] **Slice 9.2: Active** [IN_PROGRESS] [CORE / DATA] Target files: a.mjs\n';
  const s = deriveState({ progressText });
  assert.equal(s.slices[0].status, 'in-progress');
  assert.equal(s.slices[0].source, 'PROGRESS.md');
  assert.equal(s.slices[0].pr, null);
  assert.equal(s.slices[0].checks, null);
});

test('plain unchecked slice gets status open', () => {
  const s = deriveState({ progressText: '- [ ] **Slice 9.3: Queued** [UI / VISUAL]\n' });
  assert.equal(s.slices[0].status, 'open');
});

test('Slice 8.3 does not match a PR titled Slice 8.30', () => {
  const progressText = '- [ ] **Slice 8.3: Thing** [CORE / DATA]\n';
  const prs = [pr({ number: 30, title: 'Slice 8.30: Other' }), pr({ number: 31, headRef: 'claude/slice-8.30-x' })];
  const s = deriveState({ progressText, prs });
  assert.equal(s.slices[0].pr, null);
  assert.deepEqual(s.prOnly.map((c) => c.id), ['8.30', '8.30']);
  assert.deepEqual(s.prOnly.map((c) => c.pr.number), [30, 31]);
});

test('Slice 8.3 matches a PR by headRef slice-8.3', () => {
  const progressText = '- [ ] **Slice 8.3: Thing** [CORE / DATA]\n';
  const prs = [pr({ number: 40, headRef: 'claude/slice-8.3-thing' })];
  const s = deriveState({ progressText, prs });
  assert.equal(s.slices[0].pr.number, 40);
  assert.deepEqual(s.prOnly, []);
});

test('open PR naming a slice not in PROGRESS shows in prOnly', () => {
  const progressText = '- [ ] **Slice 9.1: Known** [CORE / DATA]\n';
  const prs = [
    pr({ number: 50, title: 'Slice 9.9: Pushed early', headRef: 'claude/slice-9.9-early', headSha: 'sha9' }),
    pr({ number: 51, title: 'Slice 9.1: Known' }),
    pr({ number: 52, title: 'Slice 9.8: Closed', state: 'closed', merged: false }),
  ];
  const s = deriveState({ progressText, prs, checkRunsByHeadSha: { sha9: [{ name: 'ci', status: 'completed', conclusion: 'success' }] } });
  assert.equal(s.prOnly.length, 1);
  assert.equal(s.prOnly[0].id, '9.9');
  assert.equal(s.prOnly[0].pr.number, 50);
  assert.equal(s.prOnly[0].source, 'PR #50');
  assert.deepEqual(s.prOnly[0].checks, [{ name: 'ci', status: 'completed', conclusion: 'success' }]);
  assert.equal(s.slices[0].pr.number, 51);
});

test('checks attach by head sha', () => {
  const progressText = '- [ ] **Slice 7.1: Checked** [CORE / DATA]\n';
  const prs = [pr({ number: 60, title: 'Slice 7.1: Checked', headSha: 'deadbeef' })];
  const checkRunsByHeadSha = {
    deadbeef: [{ name: 'test', status: 'completed', conclusion: 'failure', extra: 'dropped' }],
    other: [{ name: 'nope', status: 'queued', conclusion: null }],
  };
  const s = deriveState({ progressText, prs, checkRunsByHeadSha });
  assert.deepEqual(s.slices[0].checks, [{ name: 'test', status: 'completed', conclusion: 'failure' }]);
});

test('no checks for a head sha absent from the map', () => {
  const progressText = '- [ ] **Slice 7.2: Unchecked** [CORE / DATA]\n';
  const prs = [pr({ number: 61, title: 'Slice 7.2: Unchecked', headSha: 'nothere' })];
  const s = deriveState({ progressText, prs, checkRunsByHeadSha: {} });
  assert.equal(s.slices[0].pr.number, 61);
  assert.equal(s.slices[0].checks, null);
});

test('sources carry ref, sha and fetchedAt', () => {
  const s = deriveState({ progressText: '', originSha: 'abc123', fetchedAt: '2026-11-05T10:00:00Z' });
  assert.deepEqual(s.sources, {
    progress: { ref: 'origin/main', sha: 'abc123', fetchedAt: '2026-11-05T10:00:00Z' },
    github: { fetchedAt: '2026-11-05T10:00:00Z' },
  });
});

test('malformed input does not throw', () => {
  const bad = [
    undefined,
    null,
    42,
    {},
    { progressText: null, prs: 'nope', checkRunsByHeadSha: null, fetchedAt: 7 },
    { progressText: 12, prs: [null, 5, 'x', { number: 'abc' }, { number: 3, title: null, headRef: 9 }], checkRunsByHeadSha: [] },
    { progressText: '- [ ] **Slice : broken**\n- [x] **Slice 5.1: ok** Merged: PR #x by\n\n', prs: [{ number: 4, state: 'open', title: 'Slice 5.1', headSha: 'h' }], checkRunsByHeadSha: { h: 'not-an-array' } },
  ];
  for (const input of bad) {
    assert.doesNotThrow(() => deriveState(input));
  }
  const s = deriveState(bad[6]);
  assert.equal(s.slices.length, 1);
  assert.equal(s.slices[0].id, '5.1');
  assert.equal(s.slices[0].status, 'open');
  assert.equal(s.slices[0].pr.number, 4);
  assert.equal(s.slices[0].checks, null);
});

test('deriveState is deterministic', () => {
  const input = {
    progressText: '- [ ] **Slice 1.1: A** [IN_PROGRESS]\n',
    prs: [pr({ number: 9, title: 'Slice 2.2: B' })],
    fetchedAt: 't',
  };
  assert.deepEqual(deriveState(input), deriveState(input));
});

test('ghRequest sends If-None-Match and returns 304 on mocked fetch', async () => {
  let seen = null;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { status: 304, ok: false, headers: new Map([['etag', 'W/"abc"']]), json: async () => null };
  };
  const r = await ghRequest('/repos/o/r/pulls', { token: 'tok', etag: 'W/"abc"', fetchImpl });
  assert.equal(seen.url, 'https://api.github.com/repos/o/r/pulls');
  assert.equal(seen.init.headers['If-None-Match'], 'W/"abc"');
  assert.equal(seen.init.headers.Authorization, 'Bearer tok');
  assert.equal(seen.init.headers.Accept, 'application/vnd.github+json');
  assert.deepEqual(r, { status: 304, etag: 'W/"abc"', json: null });
});

test('ghRequest omits auth and If-None-Match when not given', async () => {
  let headers = null;
  const fetchImpl = async (url, init) => {
    headers = init.headers;
    return { status: 200, ok: true, headers: new Map(), json: async () => ({ ok: 1 }) };
  };
  const r = await ghRequest('/x', { fetchImpl });
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers['If-None-Match'], undefined);
  assert.deepEqual(r, { status: 200, etag: null, json: { ok: 1 } });
});

test('ghRequest throws on non-2xx without the token', async () => {
  const fetchImpl = async () => ({ status: 403, ok: false, headers: new Map(), json: async () => ({}) });
  await assert.rejects(ghRequest('/x', { token: 'secret-token', fetchImpl }), (err) => {
    assert.match(err.message, /403/);
    assert.doesNotMatch(err.message, /secret-token/);
    return true;
  });
});

test('listPullRequests maps merged_by.login and merged from merged_at', async () => {
  let url = null;
  const fetchImpl = async (u) => {
    url = u;
    return {
      status: 200,
      ok: true,
      headers: new Map([['etag', 'W/"e1"']]),
      json: async () => [
        {
          number: 63,
          title: 'Slice 9.1: T',
          state: 'closed',
          merged_at: '2026-11-01T00:00:00Z',
          merged_by: { login: 'cchonguyen' },
          head: { ref: 'claude/slice-9.1-t', sha: 'h1' },
          html_url: 'https://github.com/o/r/pull/63',
        },
        {
          number: 64,
          title: 'Slice 9.2: Open',
          state: 'open',
          merged_at: null,
          merged_by: null,
          head: { ref: 'claude/slice-9.2', sha: 'h2' },
          html_url: 'https://github.com/o/r/pull/64',
        },
      ],
    };
  };
  const r = await listPullRequests('o/r', { fetchImpl });
  assert.equal(url, 'https://api.github.com/repos/o/r/pulls?state=all&sort=updated&per_page=50');
  assert.equal(r.etag, 'W/"e1"');
  assert.deepEqual(r.prs[0], {
    number: 63,
    title: 'Slice 9.1: T',
    state: 'closed',
    merged: true,
    mergedBy: 'cchonguyen',
    mergedAt: '2026-11-01T00:00:00Z',
    headRef: 'claude/slice-9.1-t',
    headSha: 'h1',
    htmlUrl: 'https://github.com/o/r/pull/63',
  });
  assert.equal(r.prs[1].merged, false);
  assert.equal(r.prs[1].mergedBy, null);
});

test('listPullRequests returns prs null on 304', async () => {
  const fetchImpl = async () => ({ status: 304, ok: false, headers: new Map(), json: async () => null });
  const r = await listPullRequests('o/r', { etag: 'W/"x"', fetchImpl });
  assert.equal(r.status, 304);
  assert.equal(r.prs, null);
});

test('checkRunsFor maps check runs to name, status, conclusion', async () => {
  let url = null;
  const fetchImpl = async (u) => {
    url = u;
    return {
      status: 200,
      ok: true,
      headers: new Map(),
      json: async () => ({ check_runs: [{ name: 'lint', status: 'completed', conclusion: 'success', id: 1 }] }),
    };
  };
  const r = await checkRunsFor('o/r', 'abc', { fetchImpl });
  assert.equal(url, 'https://api.github.com/repos/o/r/commits/abc/check-runs');
  assert.deepEqual(r.checks, [{ name: 'lint', status: 'completed', conclusion: 'success' }]);
});

test('tokenFromEnv prefers GITHUB_TOKEN then GH_TOKEN', () => {
  assert.equal(tokenFromEnv({ GITHUB_TOKEN: 'a', GH_TOKEN: 'b' }), 'a');
  assert.equal(tokenFromEnv({ GH_TOKEN: 'b' }), 'b');
  assert.equal(tokenFromEnv({}), '');
});
