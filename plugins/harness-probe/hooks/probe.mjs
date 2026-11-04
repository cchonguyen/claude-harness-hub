#!/usr/bin/env node
// Harness probe hook. Writes one marker file per hook event into the project
// directory, and refuses any Write/Edit whose path ends in PROBE_REFUSE.txt.
// Exit 2 blocks the tool call and feeds stderr back to the model.

import fs from 'node:fs';
import path from 'node:path';

export const REFUSE_SUFFIX = 'PROBE_REFUSE.txt';

// Pure decision function so the refusal rule can be unit tested.
export function decide(mode, payload = {}) {
  if (mode === 'pre-tool') {
    const target = String(payload.tool_input?.file_path || payload.tool_input?.path || '');
    if (target.endsWith(REFUSE_SUFFIX)) {
      return { block: true, message: `HARNESS PROBE REFUSAL: writes to ${REFUSE_SUFFIX} are blocked by the harness-probe plugin.` };
    }
  }
  return { block: false };
}

export function markerRecord(mode, payload = {}) {
  return {
    mode,
    at: new Date().toISOString(),
    hook_event_name: payload.hook_event_name || null,
    tool_name: payload.tool_name || null,
    agent_type: payload.agent_type ?? null,
    stop_hook_active: payload.stop_hook_active ?? null,
    keys: Object.keys(payload).sort()
  };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
if (isMain) {
  const mode = process.argv[2] || 'unknown';
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch {}

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    const dir = path.join(root, '.harness-probe');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${mode}.json`), JSON.stringify(markerRecord(mode, payload), null, 2));
  } catch {}

  const verdict = decide(mode, payload);
  if (verdict.block) {
    process.stderr.write(verdict.message + '\n');
    process.exit(2);
  }
  process.exit(0);
}
