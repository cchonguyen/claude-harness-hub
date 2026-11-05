/**
 * dashboard/lib/derive-state.mjs
 * Pure derivation of dashboard state from already-fetched inputs.
 * No I/O here: callers pass PROGRESS.md text, PR records and check runs.
 * Node built-ins only (none needed).
 */

// Same slice-line shape as dashboard/lib/progress.mjs.
const SLICE_LINE = /^\s*- \[([ x])\] \*\*Slice ([^:*]+): ([^*]+)\*\*/;
const MERGED_SUFFIX = /Merged:\s*PR #(\d+) by ([^\s.|]+)/;
// Slice id named in free text, e.g. "Slice 8.3" or "slice-8.3-foo".
const NAMED_SLICE = /(?<![A-Za-z0-9])slice[ -](\d+(?:\.\d+)*)(?!\d|\.\d)/i;

function str(v) {
  return typeof v === 'string' ? v : '';
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses slice lines in PROGRESS.md text.
 * @returns {{ id: string, title: string, progressStatus: string, mergedPrNumber: number|null, mergedLogin: string|null }[]}
 */
function parseSlices(text) {
  const out = [];
  if (typeof text !== 'string') return out;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const m = SLICE_LINE.exec(line);
    if (!m) continue;
    const id = m[2].trim();
    const title = m[3].trim();
    if (!id) continue;
    const isChecked = m[1] === 'x';
    const merged = isChecked ? MERGED_SUFFIX.exec(line) : null;
    let progressStatus = 'open';
    if (merged) progressStatus = 'merged';
    else if (line.includes('[IN_PROGRESS]')) progressStatus = 'in-progress';
    out.push({
      id,
      title,
      progressStatus,
      mergedPrNumber: merged ? Number(merged[1]) : null,
      mergedLogin: merged ? merged[2] : null,
    });
  }
  return out;
}

function normalizePr(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const number = Number(raw.number);
  if (!Number.isInteger(number)) return null;
  return {
    number,
    title: str(raw.title),
    state: raw.state === 'open' ? 'open' : 'closed',
    merged: raw.merged === true,
    mergedBy: typeof raw.mergedBy === 'string' ? raw.mergedBy : null,
    mergedAt: typeof raw.mergedAt === 'string' ? raw.mergedAt : null,
    headRef: typeof raw.headRef === 'string' ? raw.headRef : null,
    headSha: typeof raw.headSha === 'string' ? raw.headSha : null,
    htmlUrl: typeof raw.htmlUrl === 'string' ? raw.htmlUrl : null,
  };
}

function normalizeChecks(runs) {
  if (!Array.isArray(runs)) return null;
  return runs
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      name: str(r.name),
      status: typeof r.status === 'string' ? r.status : null,
      conclusion: typeof r.conclusion === 'string' ? r.conclusion : null,
    }));
}

function sliceIdNamedIn(text) {
  const m = NAMED_SLICE.exec(str(text));
  return m ? m[1] : null;
}

function prNamesSlice(pr, id) {
  const re = new RegExp(`(?<![A-Za-z0-9])slice[ -]${escapeRe(id)}(?![0-9]|\\.[0-9])`, 'i');
  return re.test(pr.title) || (pr.headRef !== null && re.test(pr.headRef));
}

function pickPr(id, preferNumber, prs) {
  const candidates = prs.filter((pr) => prNamesSlice(pr, id));
  if (candidates.length === 0) return null;
  if (preferNumber !== null) {
    const exact = candidates.find((pr) => pr.number === preferNumber);
    if (exact) return exact;
  }
  return candidates[0];
}

/**
 * Derives dashboard cards from inputs. Pure and deterministic.
 * @param {{
 *   progressText?: string,
 *   originSha?: string|null,
 *   prs?: object[],
 *   checkRunsByHeadSha?: Object<string, object[]>,
 *   fetchedAt?: string|null
 * }} input
 * @returns {{
 *   slices: object[],
 *   prOnly: object[],
 *   sources: { progress: { ref: string, sha: string|null, fetchedAt: string|null }, github: { fetchedAt: string|null } }
 * }}
 */
export function deriveState(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const fetchedAt = typeof src.fetchedAt === 'string' ? src.fetchedAt : null;
  const checkMap =
    src.checkRunsByHeadSha && typeof src.checkRunsByHeadSha === 'object' ? src.checkRunsByHeadSha : {};
  const prs = (Array.isArray(src.prs) ? src.prs : []).map(normalizePr).filter(Boolean);
  const parsed = parseSlices(src.progressText);

  const checksFor = (pr) =>
    pr && pr.headSha && Object.prototype.hasOwnProperty.call(checkMap, pr.headSha)
      ? normalizeChecks(checkMap[pr.headSha])
      : null;

  const slices = parsed.map((p) => {
    const pr = pickPr(p.id, p.mergedPrNumber, prs);
    let status = p.progressStatus;
    let source = 'PROGRESS.md';
    let mergedBy = p.mergedLogin;
    if (status === 'merged') {
      if (pr && pr.merged && pr.mergedBy) mergedBy = pr.mergedBy;
    } else if (pr && pr.merged) {
      status = 'merged';
      source = `PR #${pr.number}`;
      mergedBy = pr.mergedBy;
    }
    return {
      id: p.id,
      title: p.title,
      status,
      source,
      mergedBy: mergedBy ?? null,
      pr,
      checks: checksFor(pr),
    };
  });

  const known = new Set(parsed.map((p) => p.id));
  const prOnly = [];
  for (const pr of prs) {
    if (pr.state !== 'open') continue;
    const id = sliceIdNamedIn(pr.title) ?? sliceIdNamedIn(pr.headRef);
    if (!id || known.has(id)) continue;
    prOnly.push({
      id,
      title: pr.title,
      status: 'open',
      source: `PR #${pr.number}`,
      mergedBy: null,
      pr,
      checks: checksFor(pr),
    });
  }

  return {
    slices,
    prOnly,
    sources: {
      progress: {
        ref: 'origin/main',
        sha: typeof src.originSha === 'string' ? src.originSha : null,
        fetchedAt,
      },
      github: { fetchedAt },
    },
  };
}
