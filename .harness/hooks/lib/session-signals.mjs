// Session-start signals: the main-red tag (SYSTEM_SPEC 4.C.3) and the handoff Branch Owner field (4.C.6).
// Zero dependencies. The git call is the only side effect.
import { execFileSync } from 'node:child_process';

export const MAIN_RED_TAG = 'harness-main-red';

// 'red' when origin has the tag, 'green' when it does not, 'unknown' when origin cannot be reached.
// Plain git only, so any platform can check it with no GitHub API.
export function mainRedState(root) {
  try {
    const out = execFileSync('git', ['ls-remote', '--tags', 'origin', MAIN_RED_TAG], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000,
    }).trim();
    return out ? 'red' : 'green';
  } catch {
    return 'unknown';
  }
}

// "claude", "antigravity", or null when the handoff does not name an owner
export function branchOwnerOf(handoffText) {
  const match = String(handoffText || '').match(/Branch Owner:\**\s*(claude|antigravity)\b/i);
  return match ? match[1].toLowerCase() : null;
}
