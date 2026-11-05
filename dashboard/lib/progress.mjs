/**
 * dashboard/lib/progress.mjs
 * Pure parser for in-progress slice lines in .spec/PROGRESS.md.
 * Node built-ins only (none needed).
 */

const SLICE_LINE = /^\s*- \[ \] \*\*Slice ([^:*]+): ([^*]+)\*\*/;

/**
 * Returns [{ id, title }] for every unchecked slice line that carries the [IN_PROGRESS] tag, in file order.
 * @param {string} text
 * @returns {{ id: string, title: string }[]}
 */
export function parseInProgress(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const m = SLICE_LINE.exec(line);
    if (m && line.includes('[IN_PROGRESS]')) {
      out.push({ id: m[1].trim(), title: m[2].trim() });
    }
  }
  return out;
}
