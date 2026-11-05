import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectContradictions, freshnessLabel } from './contradictions.mjs';

const NOW = '2026-11-05T12:00:00.000Z';
const fresh = () => ({ ok: true, fetchedAt: NOW, state: { slices: [] } });

function snap(slices, extra = {}) {
  return { ok: true, fetchedAt: NOW, state: { slices }, ...extra };
}

const kinds = (list) => list.map((c) => c.kind);

test('clean snapshot returns no contradictions', () => {
  const s = snap([
    { id: '9.1', status: 'merged', pr: { number: 10, merged: true } },
    { id: '9.7', status: 'in-progress', pr: null },
  ]);
  assert.deepEqual(detectContradictions({ snapshot: s, now: NOW, localHeadBehind: 0, lastFetchAt: NOW }), []);
});

test('in-progress-but-merged fires', () => {
  const s = snap([{ id: '9.7', status: 'in-progress', pr: { number: 42, merged: true } }]);
  const out = detectContradictions({ snapshot: s, now: NOW });
  assert.ok(kinds(out).includes('in-progress-but-merged'));
  const c = out.find((x) => x.kind === 'in-progress-but-merged');
  assert.equal(c.sliceId, '9.7');
  assert.ok(c.message.includes('9.7') && c.message.includes('PR #42'));
  assert.ok(Array.isArray(c.sources) && c.sources.length === 2);
});

test('merged-not-checked fires when PR merged but status not merged', () => {
  const s = snap([{ id: '8.3', status: 'open', pr: { number: 7, merged: true } }]);
  const out = detectContradictions({ snapshot: s, now: NOW });
  const c = out.find((x) => x.kind === 'merged-not-checked');
  assert.ok(c);
  assert.equal(c.sliceId, '8.3');
  assert.ok(c.message.includes('PR #7'));
});

test('merged-not-checked does not fire when status is merged', () => {
  const s = snap([{ id: '8.3', status: 'merged', pr: { number: 7, merged: true } }]);
  assert.deepEqual(kinds(detectContradictions({ snapshot: s, now: NOW })), []);
});

test('multiple-in-progress fires with two or more in-progress slices', () => {
  const s = snap([
    { id: '9.6', status: 'in-progress', pr: null },
    { id: '9.7', status: 'in-progress', pr: null },
  ]);
  const out = detectContradictions({ snapshot: s, now: NOW });
  const c = out.find((x) => x.kind === 'multiple-in-progress');
  assert.ok(c);
  assert.ok(c.message.includes('9.6') && c.message.includes('9.7'));
});

test('multiple-in-progress does not fire with one in-progress slice', () => {
  const s = snap([{ id: '9.6', status: 'in-progress', pr: null }]);
  assert.deepEqual(kinds(detectContradictions({ snapshot: s, now: NOW })), []);
});

test('local-behind-origin fires only for a number above 0', () => {
  const s = fresh();
  const out = detectContradictions({ snapshot: s, now: NOW, localHeadBehind: 3 });
  const c = out.find((x) => x.kind === 'local-behind-origin');
  assert.ok(c);
  assert.ok(c.message.includes('3'));
  assert.deepEqual(kinds(detectContradictions({ snapshot: s, now: NOW, localHeadBehind: 0 })), []);
  assert.deepEqual(kinds(detectContradictions({ snapshot: s, now: NOW, localHeadBehind: null })), []);
});

test('missing-referee-trailer is a no-op', () => {
  const s = snap([{ id: '9.7', status: 'in-progress', pr: null }]);
  assert.deepEqual(kinds(detectContradictions({ snapshot: s, now: NOW })), []);
});

test('stale-fetch fires at 6 minutes and not at 4', () => {
  const at4 = new Date(Date.parse(NOW) + 4 * 60 * 1000).toISOString();
  const at6 = new Date(Date.parse(NOW) + 6 * 60 * 1000).toISOString();
  const s = snap([]);
  assert.deepEqual(kinds(detectContradictions({ snapshot: s, now: at4 })), []);
  const out = detectContradictions({ snapshot: s, now: at6 });
  const c = out.find((x) => x.kind === 'stale-fetch');
  assert.ok(c);
  assert.ok(/cannot see GitHub/.test(c.message));
  assert.ok(/old/.test(c.message));
});

test('stale-fetch fires when snapshot.ok is false', () => {
  const s = { ok: false, error: 'boom', fetchedAt: NOW };
  assert.ok(kinds(detectContradictions({ snapshot: s, now: NOW })).includes('stale-fetch'));
});

test('malformed snapshot does not throw and yields stale-fetch', () => {
  const inputs = [null, undefined, 42, 'x', {}, { ok: true, state: { slices: 'nope' } }, { state: null }];
  for (const bad of inputs) {
    let out;
    assert.doesNotThrow(() => {
      out = detectContradictions({ snapshot: bad, now: NOW });
    });
    assert.ok(kinds(out).includes('stale-fetch'), `expected stale-fetch for ${JSON.stringify(bad)}`);
  }
});

test('detectContradictions with no arguments does not throw', () => {
  assert.doesNotThrow(() => detectContradictions());
});

test('freshnessLabel for 40 seconds and 7 minutes', () => {
  const t40 = new Date(Date.parse(NOW) + 40 * 1000).toISOString();
  const t7m = new Date(Date.parse(NOW) + 7 * 60 * 1000).toISOString();
  assert.equal(freshnessLabel(NOW, t40), 'fetched 40s ago');
  assert.equal(freshnessLabel(NOW, t7m), 'fetched 7m ago');
});

test('freshnessLabel handles malformed input without throwing', () => {
  assert.equal(freshnessLabel(undefined, NOW), 'fetch time unknown');
  assert.equal(freshnessLabel('not a date', NOW), 'fetch time unknown');
});
