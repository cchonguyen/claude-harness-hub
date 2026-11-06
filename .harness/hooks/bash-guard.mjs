#!/usr/bin/env node
// PreToolUse hook for Bash (SYSTEM_SPEC 4.A.5). In a spoke, blocks commands that write to engine paths or AGENTS.md.
// A speed bump only: it reads the command text, so a determined workaround can get past it. CI is the real wall.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isHubOrigin } from './lib/guard-rules.mjs';
import { currentHead, ensureDoctorState } from '../scripts/doctor.mjs';
import { gateDecision } from './lib/doctor-state.mjs';
import { mainThreadDecision } from './lib/main-thread-guard.mjs';
import { hardBlockReason } from './lib/hard-blocks.mjs';

const gitIn = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

const command = event.tool_input?.command || '';
if (!command) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let origin = '';
try { origin = gitIn(cwd, ['remote', 'get-url', 'origin']); } catch {}

// Hard blocks (engine lock in spokes, force push, branch delete, deploy, visibility change) exit 2
// regardless of doctor state or allow-list. The hub is the source of the engine files, so it is not locked.
const hard = hardBlockReason({ command, spoke: !isHubOrigin(origin) });
if (hard) {
  console.error(hard);
  process.exit(2);
}

// Live doctor gate: non-allow-listed Bash needs a DOCTOR_PASS for the current HEAD
const doctorRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const doctorHead = currentHead(doctorRoot);
const gate = gateDecision({
  state: ensureDoctorState({ root: doctorRoot, head: doctorHead }),
  head: doctorHead,
  toolName: event.tool_name || 'Bash',
  command,
});
if (!gate.allowed) {
  console.error(gate.reason);
  process.exit(2);
}

// Main-thread allow-list: subagents (agent_type set) are not restricted here
const mainThread = mainThreadDecision({ agentType: event.agent_type, toolName: 'Bash', toolInput: event.tool_input, root: doctorRoot });
if (!mainThread.allowed) {
  console.error(mainThread.reason);
  process.exit(2);
}

process.exit(0);
