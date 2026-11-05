/**
 * dashboard/lib/contradictions.mjs
 * Pure freshness and contradiction detector for the dashboard.
 * No I/O. Never throws on malformed input.
 * It shows both sides of a disagreement; it never picks one source silently.
 */

const STALE_FETCH_MS = 5 * 60 * 1000;

function toMs(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string') return Date.parse(v);
  return NaN;
}

function isObj(v) {
  return v !== null && typeof v === 'object';
}

function slicesOf(snapshot) {
  const slices = isObj(snapshot) && isObj(snapshot.state) && Array.isArray(snapshot.state.slices)
    ? snapshot.state.slices
    : [];
  return slices.filter(isObj);
}

function prOf(slice) {
  return isObj(slice.pr) ? slice.pr : null;
}

function prLabel(pr) {
  return `PR #${pr.number}`;
}

/** Rule: slice status says in-progress, but its attached PR is merged. */
export function inProgressButMergedRule(slices) {
  const out = [];
  for (const s of slices) {
    const pr = prOf(s);
    if (s.status !== 'in-progress' || !pr || pr.merged !== true) continue;
    out.push({
      id: `in-progress-but-merged:${s.id}`,
      kind: 'in-progress-but-merged',
      message: `Slice ${s.id} is marked in progress, but ${prLabel(pr)} that carries it is already merged.`,
      sliceId: String(s.id),
      sources: ['PROGRESS.md', prLabel(pr)],
    });
  }
  return out;
}

/** Rule: PR is merged, but the slice status is not merged. */
export function mergedNotCheckedRule(slices) {
  const out = [];
  for (const s of slices) {
    const pr = prOf(s);
    if (!pr || pr.merged !== true || s.status === 'merged') continue;
    out.push({
      id: `merged-not-checked:${s.id}`,
      kind: 'merged-not-checked',
      message: `${prLabel(pr)} is merged, but slice ${s.id} is not shown as merged in PROGRESS.md.`,
      sliceId: String(s.id),
      sources: [prLabel(pr), 'PROGRESS.md'],
    });
  }
  return out;
}

/** Rule: two or more slices are in progress at once. */
export function multipleInProgressRule(slices) {
  const ids = slices.filter((s) => s.status === 'in-progress').map((s) => String(s.id));
  if (ids.length < 2) return [];
  return [
    {
      id: 'multiple-in-progress',
      kind: 'multiple-in-progress',
      message: `${ids.length} slices are in progress at once (${ids.join(', ')}); the workflow expects one.`,
      sliceId: null,
      sources: ['PROGRESS.md'],
    },
  ];
}

/**
 * Rule: missing Referee trailer on a slice head commit.
 * No-op. The snapshot does not carry per-slice head commit trailer data,
 * so this rule must not invent findings. Enable it when the snapshot carries that data.
 */
export function missingRefereeTrailerRule() {
  return [];
}

/** Rule: local main is behind origin/main. Fires only for a number greater than 0. */
export function localBehindOriginRule(localHeadBehind) {
  if (typeof localHeadBehind !== 'number' || !(localHeadBehind > 0)) return [];
  const n = localHeadBehind;
  return [
    {
      id: 'local-behind-origin',
      kind: 'local-behind-origin',
      message: `Local HEAD is ${n} ${n === 1 ? 'commit' : 'commits'} behind origin/main.`,
      sliceId: null,
      sources: ['local HEAD', 'origin/main'],
    },
  ];
}

/**
 * Rule: the data is old, or the snapshot is not ok (the dashboard is blind).
 * Fires when snapshot.ok is not true, or when the fetch is more than 5 minutes old
 * (or its age cannot be read).
 */
export function staleFetchRule(snapshot, now, lastFetchAt) {
  const nowMs = toMs(now);
  const fetchedRaw = isObj(snapshot) && snapshot.fetchedAt !== undefined ? snapshot.fetchedAt : lastFetchAt;
  const fetchedMs = toMs(fetchedRaw);
  const notOk = !isObj(snapshot) || snapshot.ok !== true;
  const ageKnown = Number.isFinite(nowMs) && Number.isFinite(fetchedMs);
  const tooOld = ageKnown && nowMs - fetchedMs > STALE_FETCH_MS;
  if (!notOk && !tooOld && ageKnown) return [];
  const ageText = ageKnown ? freshnessLabel(new Date(fetchedMs).toISOString(), new Date(nowMs).toISOString()) : 'fetch time unknown';
  return [
    {
      id: 'stale-fetch',
      kind: 'stale-fetch',
      message: `The dashboard cannot see GitHub right now, so the data shown is old (${ageText}).`,
      sliceId: null,
      sources: ['GitHub', 'dashboard snapshot'],
    },
  ];
}

/**
 * Runs all rules. Pure and never throws.
 * @returns {{ id: string, kind: string, message: string, sliceId: string|null, sources: string[] }[]}
 */
export function detectContradictions({ snapshot, now, localHeadBehind, lastFetchAt } = {}) {
  try {
    const slices = slicesOf(snapshot);
    return [
      ...inProgressButMergedRule(slices),
      ...mergedNotCheckedRule(slices),
      ...multipleInProgressRule(slices),
      ...missingRefereeTrailerRule(),
      ...localBehindOriginRule(localHeadBehind),
      ...staleFetchRule(snapshot, now ?? Date.now(), lastFetchAt),
    ];
  } catch {
    return [];
  }
}

/**
 * Plain label for how old a fetch is, e.g. "fetched 40s ago" or "fetched 7m ago".
 */
export function freshnessLabel(fetchedAt, now) {
  try {
    const made = toMs(fetchedAt);
    const at = now === undefined || now === null ? Date.now() : toMs(now);
    if (!Number.isFinite(made) || !Number.isFinite(at)) return 'fetch time unknown';
    const seconds = Math.floor(Math.max(0, at - made) / 1000);
    if (seconds < 60) return `fetched ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `fetched ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `fetched ${hours}h ago`;
  } catch {
    return 'fetch time unknown';
  }
}
