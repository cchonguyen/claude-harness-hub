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
