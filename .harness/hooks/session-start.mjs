#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { activeLines, ensureBaseline, resolveRoot } from './lib/vibe.mjs';

const root = resolveRoot();
const handoffPath = path.join(root, '.spec', 'SESSION_HANDOFF.md');

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8')); } catch {}

// Vibe Mode baseline: snapshot the tree before any edit so --restore has something to go back to
try { ensureBaseline(root, event.session_id || 'default'); } catch {}

let contextMsg = `✓ Harness v2.0 active (Node ${process.version}).`;
// Only a live slice needs its handoff; in Vibe Mode a stale one would nudge /triage ceremony
if (activeLines(root).length > 0 && fs.existsSync(handoffPath)) {
  const handoff = fs.readFileSync(handoffPath, 'utf8').trim();
  if (handoff) {
    contextMsg += `\n\n[AUTO-INJECTED SESSION HANDOFF]:\n${handoff}`;
  }
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: contextMsg
  }
}));
