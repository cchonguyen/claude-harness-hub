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

let version = '2.2.0';
try { version = fs.readFileSync(path.join(root, '.harness-version'), 'utf8').trim() || version; } catch {}
let contextMsg = `✓ Harness v${version} active (Node ${process.version}).`;
// A live slice needs its handoff. In Vibe Mode a stale one would nudge /triage ceremony,
// so only a handoff left by Google AI Studio is injected (that baton pass is fresh by definition).
if (fs.existsSync(handoffPath)) {
  const handoff = fs.readFileSync(handoffPath, 'utf8').trim();
  const fromAiStudio = /Last Active Platform:\**\s*Google AI Studio/i.test(handoff);
  if (handoff && (activeLines(root).length > 0 || fromAiStudio)) {
    contextMsg += `\n\n[AUTO-INJECTED SESSION HANDOFF]:\n${handoff}`;
  }
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: contextMsg
  }
}));
