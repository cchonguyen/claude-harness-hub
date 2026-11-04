import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, markerRecord } from '../hooks/probe.mjs';

test('refuses Write/Edit to the marked probe path', () => {
  const v = decide('pre-tool', { tool_input: { file_path: '/x/y/PROBE_REFUSE.txt' } });
  assert.equal(v.block, true);
  assert.match(v.message, /HARNESS PROBE REFUSAL/);
});

test('allows other paths', () => {
  assert.equal(decide('pre-tool', { tool_input: { file_path: '/x/notes.md' } }).block, false);
  assert.equal(decide('session-start', {}).block, false);
});

test('marker record keeps role fields without the payload body', () => {
  const r = markerRecord('subagent-stop', { agent_type: 'el-architect', stop_hook_active: false, transcript_path: 'secret' });
  assert.equal(r.agent_type, 'el-architect');
  assert.equal(r.stop_hook_active, false);
  assert.ok(!JSON.stringify(r).includes('secret'));
});
