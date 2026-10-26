#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const progressPath = path.join(root, '.spec', 'PROGRESS.md');
const ACTIVE_TASK = /^\s*-\s*\[.\].*\[IN_PROGRESS\]/;

let event = {};
try { event = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

const targetFile = event.tool_input?.file_path || event.tool_input?.notebook_path || '';
if (!targetFile) process.exit(0);

const absTarget = path.resolve(root, targetFile);
const relTarget = path.relative(root, absTarget).replace(/\\/g, '/');

// 0. Files outside the project (e.g. ~/.claude memory) are not governed by the slice lock
if (relTarget.startsWith('../') || path.isAbsolute(relTarget)) process.exit(0);

// 1. If editing .spec/PROGRESS.md itself, verify incoming text doesn't mark >1 task line as [IN_PROGRESS]
if (relTarget === '.spec/PROGRESS.md') {
  const currentContent = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8') : '';
  let nextContent = currentContent;
  const input = event.tool_input || {};
  if (event.tool_name === 'Write') {
    nextContent = input.content || '';
  } else if (event.tool_name === 'Edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    // split/join avoids String.replace treating "$&" etc. in new_string as patterns
    nextContent = input.replace_all
      ? currentContent.split(input.old_string).join(input.new_string)
      : currentContent.replace(input.old_string, () => input.new_string);
  }
  const activeTaskLines = nextContent.split('\n').filter((line) => ACTIVE_TASK.test(line));

  if (activeTaskLines.length > 1) {
    console.error('WORK LOCK VIOLATION: Cannot mark more than 1 task line as [IN_PROGRESS] in .spec/PROGRESS.md.');
    process.exit(2);
  }
  process.exit(0);
}

// 2. Always permit edits to .spec/, .claude/, .harness/, or CLAUDE.md
if (relTarget.startsWith('.spec/') || relTarget.startsWith('.claude/') || relTarget.startsWith('.harness/') || relTarget === 'CLAUDE.md') {
  process.exit(0);
}

// 3. For source code edits, enforce that at most 1 task is [IN_PROGRESS] and check declared target files if specified
if (fs.existsSync(progressPath)) {
  const lines = fs.readFileSync(progressPath, 'utf8').split('\n');
  const activeLines = lines.filter((line) => ACTIVE_TASK.test(line));

  if (activeLines.length > 1) {
    console.error('WORK LOCK VIOLATION: Multiple tasks are marked [IN_PROGRESS] in .spec/PROGRESS.md. Fix .spec/PROGRESS.md first.');
    process.exit(2);
  }

  if (activeLines.length === 1) {
    const match = activeLines[0].match(/Target files:\s*(.+)$/i);
    if (match) {
      const allowedList = match[1]
        .replace(/[`*]/g, '')
        .split(',')
        .map((s) => s.trim().replace(/^\.\//, ''))
        .filter(Boolean);
      // Exact file match, or the file sits inside a listed folder (entry ending in "/")
      const isAllowed = (allowed) =>
        relTarget === allowed || relTarget.startsWith(allowed.endsWith('/') ? allowed : `${allowed}/`);
      if (allowedList.length > 0 && !allowedList.some(isAllowed)) {
        console.error(`SCOPE LOCK BLOCK: "${relTarget}" is not listed in the active slice's Target files (${allowedList.join(', ')}). Update .spec/PROGRESS.md first if this file is required.`);
        process.exit(2);
      }
    }
  }
}
process.exit(0);
