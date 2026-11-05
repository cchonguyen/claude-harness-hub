/**
 * dashboard/lib/snapshot.mjs
 * Builds the status snapshot the Pages dashboard reads (status.json).
 * Node built-ins only. The token is never written to output or logs.
 *
 * CLI: node dashboard/lib/snapshot.mjs [outPath]
 *   env GITHUB_REPOSITORY (default cchonguyen/claude-harness-hub)
 *   env GITHUB_TOKEN or GH_TOKEN (via tokenFromEnv)
 *   Always writes the file. Exit 0 when ok, 1 when not ok.
 */

import { mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { deriveState } from './derive-state.mjs';
import { listPullRequests, checkRunsFor, readGitProgress, tokenFromEnv } from './github.mjs';

const DEFAULT_REPO = 'cchonguyen/claude-harness-hub';
const DEFAULT_OUT = 'dashboard/site/status.json';
const RECENT_MERGE_MS = 7 * 24 * 60 * 60 * 1000;

function toDate(now) {
  if (now instanceof Date) return now;
  if (now === undefined || now === null) return new Date();
  return new Date(now);
}

/** Error text without the token, whatever the source. */
function safeMessage(err, token) {
  let msg = err && typeof err.message === 'string' ? err.message : String(err);
  if (token) msg = msg.split(token).join('[redacted]');
  return msg;
}

/**
 * Which PRs need check runs: all open PRs, and merged PRs merged in the last 7 days.
 * Returns a de-duplicated list of head SHAs.
 */
function shasNeedingChecks(prs, at) {
  const shas = new Set();
  for (const pr of prs) {
    if (!pr.headSha) continue;
    if (pr.state === 'open') {
      shas.add(pr.headSha);
      continue;
    }
    const mergedMs = pr.merged && pr.mergedAt ? Date.parse(pr.mergedAt) : NaN;
    if (Number.isFinite(mergedMs) && at.getTime() - mergedMs <= RECENT_MERGE_MS) {
      shas.add(pr.headSha);
    }
  }
  return [...shas];
}

/**
 * Builds a snapshot. Never throws: failures come back as { ok: false, error }.
 * @param {{
 *   repo: string,
 *   cwd: string,
 *   token?: string,
 *   now?: Date|number|string,
 *   fetchImpl?: Function,
 *   readProgress?: (cwd: string) => ({ text: string, sha: string }|null)
 * }} opts
 */
export async function buildSnapshot({
  repo,
  cwd,
  token = '',
  now,
  fetchImpl,
  readProgress = readGitProgress,
} = {}) {
  const at = toDate(now);
  const fetchedAt = at.toISOString();

  const progress = readProgress(cwd);
  if (!progress) {
    return { ok: false, error: 'origin/main PROGRESS.md unreadable', fetchedAt };
  }

  try {
    const opts = { token, fetchImpl };
    const list = await listPullRequests(repo, opts);
    const prs = list.prs ?? [];
    const prsFetchedAt = fetchedAt;

    const checkRunsByHeadSha = {};
    for (const sha of shasNeedingChecks(prs, at)) {
      const runs = await checkRunsFor(repo, sha, opts);
      checkRunsByHeadSha[sha] = runs.checks ?? [];
    }

    const state = deriveState({
      progressText: progress.text,
      originSha: progress.sha,
      prs,
      checkRunsByHeadSha,
      fetchedAt,
    });

    return {
      ok: true,
      schema: 1,
      repo,
      fetchedAt,
      source: {
        progressRef: 'origin/main',
        progressSha: progress.sha,
        prsFetchedAt,
      },
      state,
    };
  } catch (err) {
    return { ok: false, error: safeMessage(err, token), fetchedAt };
  }
}

/**
 * Short age label for the page footer, e.g. "snapshot 3m old".
 */
export function snapshotMarkdownFreshness(snapshot, now) {
  const at = toDate(now);
  const made = snapshot && typeof snapshot.fetchedAt === 'string' ? Date.parse(snapshot.fetchedAt) : NaN;
  if (!Number.isFinite(made)) return 'snapshot age unknown';
  const minutes = Math.floor(Math.max(0, at.getTime() - made) / 60000);
  if (minutes < 1) return 'snapshot <1m old';
  if (minutes < 60) return `snapshot ${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `snapshot ${hours}h old`;
  return `snapshot ${Math.floor(hours / 24)}d old`;
}

/**
 * Writes JSON atomically: tmp file in the same directory, then rename.
 * @returns {string} absolute path written
 */
export function writeSnapshotFile(snapshot, outPath) {
  const abs = resolve(outPath);
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    renameSync(tmp, abs);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // tmp may not exist; nothing to clean up
    }
    throw err;
  }
  return abs;
}

async function main(argv, env) {
  const repo = env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const token = tokenFromEnv(env);
  const outPath = argv[2] || DEFAULT_OUT;
  const snapshot = await buildSnapshot({ repo, cwd: process.cwd(), token });
  const written = writeSnapshotFile(snapshot, outPath);
  process.stdout.write(`status snapshot: ${snapshot.ok ? 'ok' : 'not ok'} -> ${written}\n`);
  if (!snapshot.ok) process.stderr.write(`status snapshot error: ${snapshot.error}\n`);
  return snapshot.ok ? 0 : 1;
}

const isEntry = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main(process.argv, process.env).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`status snapshot failed: ${safeMessage(err, tokenFromEnv(process.env))}\n`);
      process.exitCode = 1;
    },
  );
}
