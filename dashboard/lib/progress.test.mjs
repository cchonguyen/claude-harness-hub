import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInProgress } from './progress.mjs';

test('one IN_PROGRESS line returns one entry', () => {
  const text = '- [ ] **Slice 8.4: Dashboard Reads Slices** [IN_PROGRESS] [CORE / DATA] Target files: x\n';
  assert.deepEqual(parseInProgress(text), [{ id: '8.4', title: 'Dashboard Reads Slices' }]);
});

test('a [x] line is ignored', () => {
  const text = '- [x] **Slice 8.3: Done Thing** [IN_PROGRESS] [UI / VISUAL]\n';
  assert.deepEqual(parseInProgress(text), []);
});

test('a line without the IN_PROGRESS tag is ignored', () => {
  const text = '- [ ] **Slice 8.5: Queued Thing** [UI / VISUAL]\n';
  assert.deepEqual(parseInProgress(text), []);
});

test('two lines return two entries in order', () => {
  const text = [
    '- [ ] **Slice 1.1: First** [IN_PROGRESS] [CORE / DATA]',
    '- [ ] **Slice 1.2: Second** [IN_PROGRESS] [UI / VISUAL]',
  ].join('\n');
  assert.deepEqual(parseInProgress(text), [
    { id: '1.1', title: 'First' },
    { id: '1.2', title: 'Second' },
  ]);
});

test('empty text returns []', () => {
  assert.deepEqual(parseInProgress(''), []);
});

test('an [x] line with Awaiting-accept is returned', () => {
  const text = '- [x] **Slice 8.6: Waiting Thing** [CORE / DATA] Awaiting-accept\n';
  assert.deepEqual(parseInProgress(text), [{ id: '8.6', title: 'Waiting Thing' }]);
});

test('an [x] line with no marker is ignored', () => {
  const text = '- [x] **Slice 8.7: Plain Done** [CORE / DATA]\n';
  assert.deepEqual(parseInProgress(text), []);
});

test('a line with Awaiting-accept and Accepted-by-plan is ignored', () => {
  const text = '- [x] **Slice 8.8: Accepted Thing** [CORE / DATA] Awaiting-accept Accepted-by-plan\n';
  assert.deepEqual(parseInProgress(text), []);
});

test('an [IN_PROGRESS] line is still returned', () => {
  const text = '- [ ] **Slice 8.9: Active Thing** [IN_PROGRESS] [UI / VISUAL]\n';
  assert.deepEqual(parseInProgress(text), [{ id: '8.9', title: 'Active Thing' }]);
});
