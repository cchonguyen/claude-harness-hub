import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, acceptSlices } from './accept-plan.mjs';

test('parsePlan reads the id and slice lines and ignores other lines', () => {
  const text = '# Plan: p-1\n\nSome note.\n- slice: 8.3\n- slice: 8.4\n';
  assert.deepEqual(parsePlan(text), { id: 'p-1', sliceIds: ['8.3', '8.4'] });
});

test('parsePlan throws when the header is missing', () => {
  assert.throws(() => parsePlan('- slice: 8.3\n'), /# Plan:/);
});

test('parsePlan throws when no slice is listed', () => {
  assert.throws(() => parsePlan('# Plan: p-2\nno slices here\n'), /zero slices/);
});

test('acceptSlices marks an open line [x] with the plan suffix', () => {
  const progress = '- [ ] **Slice 8.3: Thing**  Target files: a.mjs | Verify: x\n- [x] **Slice 8.2: Old**\n';
  const r = acceptSlices(progress, ['8.3'], 'p-1');
  assert.equal(
    r.text,
    '- [x] **Slice 8.3: Thing**  Target files: a.mjs | Verify: x Accepted-by-plan: p-1\n- [x] **Slice 8.2: Old**\n',
  );
  assert.deepEqual(r.accepted, ['8.3']);
  assert.deepEqual(r.already, []);
  assert.deepEqual(r.missing, []);
});

test('acceptSlices treats an [IN_PROGRESS] line as open and removes the token', () => {
  const progress = '- [ ] **Slice 8.3: Thing** [IN_PROGRESS] [CORE / DATA] Verify: x\n';
  const r = acceptSlices(progress, ['8.3'], 'p-1');
  assert.equal(
    r.text,
    '- [x] **Slice 8.3: Thing** [CORE / DATA] Verify: x Accepted-by-plan: p-1\n',
  );
  assert.deepEqual(r.accepted, ['8.3']);
});

test('acceptSlices reports already-accepted slices and leaves them unchanged', () => {
  const progress = '- [x] **Slice 8.2: Old** Verify: x\n';
  const r = acceptSlices(progress, ['8.2'], 'p-1');
  assert.equal(r.text, progress);
  assert.deepEqual(r.already, ['8.2']);
  assert.deepEqual(r.accepted, []);
});

test('acceptSlices reports missing slices and leaves the text unchanged', () => {
  const progress = '- [ ] **Slice 8.3: Thing** Verify: x\n';
  const r = acceptSlices(progress, ['9.9'], 'p-1');
  assert.equal(r.text, progress);
  assert.deepEqual(r.missing, ['9.9']);
  assert.deepEqual(r.accepted, []);
});

test('acceptSlices does not confuse 8.3 with 8.30', () => {
  const progress = '- [ ] **Slice 8.30: Other** Verify: x\n';
  const r = acceptSlices(progress, ['8.3'], 'p-1');
  assert.equal(r.text, progress);
  assert.deepEqual(r.missing, ['8.3']);
});
