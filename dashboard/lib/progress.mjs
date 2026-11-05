/**
 * dashboard/lib/progress.mjs
 * Pure parser for in-progress slice lines in .spec/PROGRESS.md.
 * Node built-ins only (none needed).
 */

const SLICE_LINE = /^\s*- \[([ x])\] \*\*Slice ([^:*]+): ([^*]+)\*\*/;

/**
 * Returns [{ id, title }] for every slice line shown on the dashboard, in file order.
 * A slice line is shown when it matches the slice-line regex (checked `[x]` or unchecked `[ ]`)
 * and either:
 *   - it is unchecked and carries the [IN_PROGRESS] tag, or
 *   - it carries the Awaiting-accept marker (checked or unchecked).
 * Any line carrying Accepted-by-plan is never shown, whatever its other markers.
 * @param {string} text
 * @returns {{ id: string, title: string }[]}
 */
export function parseInProgress(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const m = SLICE_LINE.exec(line);
    if (!m || line.includes('Accepted-by-plan')) continue;
    const unchecked = m[1] === ' ';
    const inProgress = unchecked && line.includes('[IN_PROGRESS]');
    const awaiting = line.includes('Awaiting-accept');
    if (inProgress || awaiting) {
      out.push({ id: m[2].trim(), title: m[3].trim() });
    }
  }
  return out;
}
