/**
 * dashboard/lib/github.mjs
 * Thin GitHub REST helpers and git reads for the dashboard.
 * Node built-ins only. The token is never logged.
 */

import { execFileSync } from 'node:child_process';

const API = 'https://api.github.com';

/**
 * GET an api.github.com path.
 * @returns {Promise<{ status: number, etag: string|null, json: any }>}
 */
export async function ghRequest(path, { token, etag, fetchImpl = fetch } = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (etag) headers['If-None-Match'] = etag;

  const res = await fetchImpl(`${API}${path}`, { headers });
  const newEtag = res.headers && typeof res.headers.get === 'function' ? res.headers.get('etag') : null;

  if (res.status === 304) {
    return { status: 304, etag: newEtag ?? etag ?? null, json: null };
  }
  if (!(res.status >= 200 && res.status < 300)) {
    throw new Error(`GitHub API responded ${res.status} for ${path}`);
  }
  const json = await res.json();
  return { status: res.status, etag: newEtag ?? null, json };
}

/**
 * List recent pull requests, mapped to the derive-state PR shape.
 * On 304 returns prs: null so the caller keeps its cached list.
 * @returns {Promise<{ status: number, etag: string|null, prs: object[]|null }>}
 */
export async function listPullRequests(repo, opts = {}) {
  const r = await ghRequest(`/repos/${repo}/pulls?state=all&sort=updated&per_page=50`, opts);
  if (r.status === 304) return { status: 304, etag: r.etag, prs: null };
  const list = Array.isArray(r.json) ? r.json : [];
  const prs = list.map((pr) => ({
    number: pr.number,
    title: pr.title ?? '',
    state: pr.state === 'open' ? 'open' : 'closed',
    merged: pr.merged_at != null,
    mergedBy: pr.merged_by?.login ?? null,
    mergedAt: pr.merged_at ?? null,
    headRef: pr.head?.ref ?? null,
    headSha: pr.head?.sha ?? null,
    htmlUrl: pr.html_url ?? null,
  }));
  return { status: r.status, etag: r.etag, prs };
}

/**
 * Check runs for a commit, mapped to { name, status, conclusion }.
 * On 304 returns checks: null.
 * @returns {Promise<{ status: number, etag: string|null, checks: object[]|null }>}
 */
export async function checkRunsFor(repo, sha, opts = {}) {
  const r = await ghRequest(`/repos/${repo}/commits/${encodeURIComponent(sha)}/check-runs`, opts);
  if (r.status === 304) return { status: 304, etag: r.etag, checks: null };
  const runs = Array.isArray(r.json?.check_runs) ? r.json.check_runs : [];
  const checks = runs.map((c) => ({
    name: c.name ?? '',
    status: c.status ?? null,
    conclusion: c.conclusion ?? null,
  }));
  return { status: r.status, etag: r.etag, checks };
}

/**
 * Reads .spec/PROGRESS.md from origin/main in the local clone. Does not fetch.
 * @returns {{ text: string, sha: string }|null}
 */
export function readGitProgress(cwd) {
  try {
    const opts = { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const text = execFileSync('git', ['show', 'origin/main:.spec/PROGRESS.md'], opts);
    const sha = execFileSync('git', ['rev-parse', 'origin/main'], opts).trim();
    return { text, sha };
  } catch {
    return null;
  }
}

/**
 * Token from the environment only. Never shells out to gh.
 */
export function tokenFromEnv(env = process.env) {
  return env.GITHUB_TOKEN || env.GH_TOKEN || '';
}
