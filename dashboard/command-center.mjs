#!/usr/bin/env node
/**
 * dashboard/command-center.mjs
 * Vibe Coding Command Center: local, read-mostly view of harness worktrees.
 *
 * Security posture (Plan v2.2, Phase 3):
 *  - Binds only to 127.0.0.1:3456.
 *  - Host and Origin headers must be 127.0.0.1:3456 or localhost:3456.
 *  - Every /api/* request needs a per-session 32-byte token in X-Command-Token.
 *  - .spec/ reads are canonicalized with fs.realpathSync and must stay inside .spec/.
 *  - No task-deletion or mutation routes beyond the two gated POST actions.
 *  - Uses Node built-ins only (no npm dependencies).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseInProgress } from './lib/progress.mjs';
import { buildSnapshot as buildDerivedSnapshot } from './lib/snapshot.mjs';
import { tokenFromEnv } from './lib/github.mjs';

const execFileP = promisify(execFile);

const HOST = '127.0.0.1';
const PORT = 3456;
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ALLOWED_ORIGINS = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const TOKEN = crypto.randomBytes(32).toString('hex');
const STALE_MS = 30 * 60 * 1000;
const REDISCOVER_MS = 30 * 1000;
const HERDR_CACHE_MS = 5 * 1000;

const HERE = path.dirname(new URL(import.meta.url).pathname);
const HARNESS_ROOT = path.resolve(HERE, '..');
const UPDATE_SCRIPT = path.join(HARNESS_ROOT, 'bin', 'update-state.mjs');
// Secret from HARNESS_VERIFY_SECRET or ~/.config/vibe-command-center/verify-secret (not in the repo).
const INTERNAL_SECRET = process.env.HARNESS_VERIFY_SECRET?.trim() ||
  (() => { try { return fs.readFileSync(path.join(os.homedir(), '.config', 'vibe-command-center', 'verify-secret'), 'utf8').trim(); } catch { return ''; } })();
const REPOS_FILE = path.join(os.homedir(), '.config', 'vibe-command-center', 'repos.json');
const TASKS_DIR = path.join(os.homedir(), '.claude', 'tasks');
const HTML_FILE = path.join(HERE, 'index.html');

const STAGES = ['Design', 'Falcon-Review', 'Implementation', 'Claimed', 'Verified', 'Accepted'];

// ---------- helpers ----------

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string';
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : headers['Content-Type'] || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function tokenOk(req) {
  const given = req.headers['x-command-token'];
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hostOriginOk(req) {
  if (!ALLOWED_HOSTS.has(req.headers.host || '')) return false;
  const origin = req.headers.origin;
  if (origin !== undefined && !ALLOWED_ORIGINS.has(origin)) return false;
  return true;
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ---------- repos & worktrees ----------

function loadRepos() {
  try {
    const cfg = JSON.parse(fs.readFileSync(REPOS_FILE, 'utf8'));
    return (cfg.repos || []).filter((r) => r && typeof r.path === 'string' && fs.existsSync(r.path));
  } catch {
    return [];
  }
}

async function git(cwd, args) {
  const { stdout } = await execFileP('git', ['-C', cwd, ...args], { timeout: 5000 });
  return stdout.trim();
}

let worktrees = []; // [{ repo, path }]

async function discoverWorktrees() {
  const found = [];
  for (const repo of loadRepos()) {
    try {
      const out = await git(repo.path, ['worktree', 'list', '--porcelain']);
      for (const line of out.split('\n')) {
        if (line.startsWith('worktree ')) {
          const wt = line.slice('worktree '.length).trim();
          if (fs.existsSync(path.join(wt, '.spec'))) found.push({ repo: repo.name, path: fs.realpathSync(wt) });
        }
      }
    } catch {
      // repo unreadable: skip it
    }
  }
  worktrees = found;
  return found;
}

// ---------- canonical .spec/ reads ----------

/** Returns the canonical file path inside <worktree>/.spec, or throws an error with .status. */
function resolveSpecFile(worktreePath, relFile) {
  const specDir = fs.realpathSync(path.join(worktreePath, '.spec'));
  const lexical = path.resolve(specDir, relFile);
  if (lexical !== specDir && !lexical.startsWith(specDir + path.sep)) {
    throw Object.assign(new Error('path outside .spec'), { status: 403 });
  }
  let real;
  try {
    real = fs.realpathSync(lexical);
  } catch {
    throw Object.assign(new Error('not found'), { status: 404 });
  }
  if (real !== specDir && !real.startsWith(specDir + path.sep)) {
    throw Object.assign(new Error('symlink escapes .spec'), { status: 403 });
  }
  return real;
}

function readSpecJson(worktreePath, relFile) {
  try {
    const file = resolveSpecFile(worktreePath, relFile);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** In-progress slices listed only in .spec/PROGRESS.md. Returns [] on any error. */
function readProgressSlices(worktreePath) {
  try {
    const file = resolveSpecFile(worktreePath, 'PROGRESS.md');
    return parseInProgress(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function fileMtime(p) {
  try {
    return fs.statSync(p).mtime.toISOString();
  } catch {
    return null;
  }
}

// ---------- Herdr runtime state ----------

let herdrCache = { at: 0, agents: [] };

async function herdrAgents() {
  if (Date.now() - herdrCache.at < HERDR_CACHE_MS) return herdrCache.agents;
  let agents = [];
  try {
    const { stdout } = await execFileP('herdr', ['agent', 'list'], { timeout: 3000 });
    const parsed = JSON.parse(stdout);
    // Live shape: {"result":{"agents":[...]}}
    const list = Array.isArray(parsed) ? parsed : parsed.result?.agents || parsed.agents || [];
    agents = list.filter((a) => a && typeof a === 'object');
  } catch {
    agents = []; // herdr missing, not running, or output not parseable
  }
  herdrCache = { at: Date.now(), agents };
  return agents;
}

const HERDR_LABEL = { working: 'Working', blocked: 'Blocked', idle: 'Idle' };
// Herdr pane ids look like "w1:p1", which the required /^[a-zA-Z0-9_-]+$/ check rejects, so the UI uses this safe form.
const safeAgentId = (paneId) => String(paneId).replace(/:/g, '_');

function herdrForWorktree(agents, wtPath) {
  for (const a of agents) {
    const where = a.cwd || a.path || a.worktree;
    if (typeof where === 'string' && path.resolve(where) === wtPath) {
      const label = HERDR_LABEL[String(a.agent_status || '').toLowerCase()];
      return { state: label || 'Offline', agentId: typeof a.pane_id === 'string' ? safeAgentId(a.pane_id) : null };
    }
  }
  return { state: 'Offline', agentId: null };
}

// ---------- snapshot ----------

async function headSha(wtPath) {
  try {
    return await git(wtPath, ['rev-parse', '--short', 'HEAD']);
  } catch {
    return null;
  }
}

// ---------- derived state (GitHub-backed, cached) ----------

const DERIVED_REPO = process.env.GITHUB_REPOSITORY || 'cchonguyen/claude-harness-hub';
const DERIVED_CACHE_MS = 60 * 1000;
let derivedCache = { at: 0, value: null }; // value: result of lib/snapshot.mjs buildSnapshot
let derivedInFlight = null;

/**
 * Promise for a derived snapshot, at most one fetch per DERIVED_CACHE_MS.
 * Concurrent callers share one in-flight promise. Never rejects.
 */
function derivedSnapshot() {
  try {
    if (derivedCache.value && Date.now() - derivedCache.at < DERIVED_CACHE_MS) {
      return Promise.resolve(derivedCache.value);
    }
    if (!derivedInFlight) {
      const run = (async () => {
        let value;
        try {
          value = await buildDerivedSnapshot({ repo: DERIVED_REPO, cwd: HARNESS_ROOT, token: tokenFromEnv(process.env) });
        } catch {
          value = { ok: false, error: 'derived snapshot failed', fetchedAt: new Date().toISOString() };
        }
        derivedCache = { at: Date.now(), value };
        return value;
      })().finally(() => {
        derivedInFlight = null;
      });
      derivedInFlight = run;
      run.then(() => broadcast(), () => {});
    }
    return derivedInFlight;
  } catch {
    return Promise.resolve(derivedCache.value);
  }
}

async function buildSnapshot() {
  const now = Date.now();
  const agents = await herdrAgents();
  const cards = [];
  for (const wt of worktrees) {
    const state = readSpecJson(wt.path, 'STATE.json');
    const currentHeadSha = await headSha(wt.path);
    const herdr = herdrForWorktree(agents, wt.path);
    const updatedMs = state?.updatedAt ? Date.parse(state.updatedAt) : NaN;
    const stale = Number.isFinite(updatedMs) && now - updatedMs > STALE_MS && herdr.state === 'Offline';
    const ver = state?.verification || null;
    // Verification and acceptance are still per worktree: only the worktree-level stage can be accepted.
    const canAccept = state?.stage === 'Verified' && ver?.testsPassing === true && ver?.evidenceCommitSha === currentHeadSha;
    const worktreeStage = state?.stage && STAGES.includes(state.stage) ? state.stage : 'Design';

    // One card per active slice; a worktree with no slices gets one card for its worktree-level stage.
    const stateSlices = Array.isArray(state?.activeSlices) && state.activeSlices.length
      ? state.activeSlices.map((s) => ({ id: String(s.id), title: String(s.title || ''), stage: s.stage || null }))
      : [];

    // Slices seen only in .spec/PROGRESS.md: stage Implementation, no verification, never acceptable.
    const knownIds = new Set(stateSlices.map((s) => s.id));
    const progressOnlyIds = new Set();
    const progressOnly = [];
    for (const p of readProgressSlices(wt.path)) {
      if (knownIds.has(p.id)) continue;
      knownIds.add(p.id);
      progressOnlyIds.add(p.id);
      progressOnly.push({ id: p.id, title: p.title, stage: 'Implementation' });
    }

    const slices = [...stateSlices, ...progressOnly];
    if (!slices.length) slices.push(null);

    for (const sl of slices) {
      const isProgressOnly = sl ? progressOnlyIds.has(sl.id) : false;
      const baseStage = sl?.stage && STAGES.includes(sl.stage) ? sl.stage : worktreeStage;
      let stage = baseStage;
      let badge = null;
      // Epistemic gate: verified/accepted evidence must match the current HEAD.
      if ((stage === 'Verified' || stage === 'Accepted') && (!ver || ver.evidenceCommitSha !== currentHeadSha)) {
        badge = 'EVIDENCE STALE (HEAD != Verified SHA)';
        stage = 'Claimed';
      }
      cards.push({
        repo: wt.repo,
        worktree: wt.path,
        worktreeId: path.basename(wt.path),
        sliceId: sl?.id || null,
        sliceTitle: sl?.title || null,
        branch: state?.branch || null,
        currentIntent: state?.currentIntent || null,
        activeSlice: sl?.id ? { id: sl.id, title: sl.title } : (state?.activeSlice?.id ? { id: String(state.activeSlice.id), title: String(state.activeSlice.title || '') } : null),
        stage,
        rawStage: baseStage,
        badge,
        stale,
        staleLabel: stale ? 'STALE (>30m)' : null,
        updatedAt: state?.updatedAt || null,
        pendingDecisions: Array.isArray(state?.pendingDecisions) ? state.pendingDecisions.length : 0,
        verification: !isProgressOnly && ver ? { testsPassing: ver.testsPassing, evidenceCommitSha: ver.evidenceCommitSha } : null,
        currentHeadSha,
        canAccept: isProgressOnly ? false : canAccept,
        herdr: herdr.state,
        herdrAgentId: herdr.agentId,
        handoffUpdatedAt: fileMtime(path.join(wt.path, '.spec', 'HANDOFF_PACKET.md')),
      });
    }
  }

  // Never awaited here: use the cached value (or null) now; a fetch in progress lands via broadcast().
  derivedSnapshot();
  const derived = derivedCache.value;
  const derivedBlind = !derived || derived.ok !== true;
  return { generatedAt: new Date(now).toISOString(), stages: STAGES, cards, derived, derivedBlind };
}

// ---------- live updates (SSE) ----------

const clients = new Set();
const watchers = new Map(); // dir -> FSWatcher
let debounce = null;

function broadcast() {
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    const snap = await buildSnapshot();
    const payload = `event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`;
    for (const res of clients) res.write(payload);
  }, 300);
}

function watchDir(dir, recursive) {
  if (watchers.has(dir) || !fs.existsSync(dir)) return;
  try {
    const w = fs.watch(dir, { recursive }, (_evt, name) => {
      // Only care about the files we promised to watch.
      const n = String(name || '');
      if (!recursive && !/^(STATE\.json|HANDOFF_PACKET\.md)$/.test(n)) return;
      if (recursive && /(^|[\\/])(\.git|node_modules|dist)([\\/]|$)/.test(n)) return;
      broadcast();
    });
    w.on('error', () => watchers.delete(dir));
    watchers.set(dir, w);
  } catch {
    // unsupported platform or missing dir: polling refresh still covers it
  }
}

function refreshWatchers() {
  for (const wt of worktrees) watchDir(path.join(wt.path, '.spec'), false);
  watchDir(TASKS_DIR, true);
}

async function rediscoverAndRefresh() {
  await discoverWorktrees();
  refreshWatchers();
  broadcast(); // also re-stamps currentHeadSha on every update
}

// ---------- routes ----------

async function handleAccept(req, res) {
  if (!INTERNAL_SECRET) return send(res, 500, { error: 'no verify secret configured' });
  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'invalid JSON' });
  }
  const wt = worktrees.find((w) => w.path === body.worktree);
  if (!wt) return send(res, 403, { error: 'unknown worktree' });

  const state = readSpecJson(wt.path, 'STATE.json');
  const head = await headSha(wt.path);
  if (!state) return send(res, 409, { error: 'no STATE.json' });
  if (state.verification?.testsPassing !== true) return send(res, 409, { error: 'tests not passing' });
  if (state.verification?.evidenceCommitSha !== head) return send(res, 409, { error: 'HEAD does not match verified SHA' });

  try {
    const { stdout } = await execFileP(
      process.execPath,
      [UPDATE_SCRIPT, '--stage', 'Accepted', '--internal-key', INTERNAL_SECRET],
      { cwd: wt.path, timeout: 10000 }
    );
    broadcast();
    return send(res, 200, { ok: true, output: stdout.trim() });
  } catch (e) {
    return send(res, 500, { error: 'update-state failed', detail: String(e.stderr || e.message).slice(0, 300) });
  }
}

async function handleHerdrFocus(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'invalid JSON' });
  }
  if (body.action !== undefined && body.action !== 'focus') return send(res, 403, { error: 'action not allowed' });
  const SAFE = /^[a-zA-Z0-9_-]+$/;
  if (typeof body.worktreeId !== 'string' || !SAFE.test(body.worktreeId)) return send(res, 400, { error: 'invalid worktreeId' });
  if (typeof body.paneId !== 'string' || !SAFE.test(body.paneId)) return send(res, 400, { error: 'invalid paneId' });
  const wt = worktrees.find((w) => path.basename(w.path) === body.worktreeId);
  if (!wt) return send(res, 404, { error: 'unknown worktree' });
  const agent = (await herdrAgents()).find((a) => a.cwd === wt.path && typeof a.pane_id === 'string' && safeAgentId(a.pane_id) === body.paneId);
  if (!agent) return send(res, 404, { error: 'agent not found' });
  try {
    await execFileP('herdr', ['agent', 'focus', agent.pane_id], { timeout: 5000 });
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 500, { error: 'focus failed' });
  }
}

const server = http.createServer(async (req, res) => {
  if (!hostOriginOk(req)) return send(res, 403, { error: 'host or origin rejected' });

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/') {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8').replace('__COMMAND_TOKEN__', TOKEN);
      return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8' });
    } catch {
      return send(res, 500, { error: 'UI missing' });
    }
  }

  if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });
  if (!tokenOk(req)) return send(res, 403, { error: 'missing or bad token' });

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return send(res, 200, await buildSnapshot());
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    clients.add(res);
    res.write(`event: snapshot\ndata: ${JSON.stringify(await buildSnapshot())}\n\n`);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/spec') {
    const wtPath = url.searchParams.get('worktree') || '';
    const file = url.searchParams.get('file') || '';
    const wt = worktrees.find((w) => w.path === wtPath);
    if (!wt) return send(res, 403, { error: 'unknown worktree' });
    try {
      const real = resolveSpecFile(wt.path, file);
      const text = fs.readFileSync(real, 'utf8');
      // Rendered as plain text by the UI (never as HTML), so no markup injection.
      return send(res, 200, text, { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch (e) {
      return send(res, e.status || 500, { error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/slice/accept') return handleAccept(req, res);
  if (req.method === 'POST' && url.pathname === '/api/herdr/focus') return handleHerdrFocus(req, res);

  return send(res, 404, { error: 'not found' });
});

// Only bind to loopback.
discoverWorktrees()
  .then(() => {
    refreshWatchers();
    setInterval(rediscoverAndRefresh, REDISCOVER_MS).unref();
    setInterval(() => {
      for (const res of clients) res.write(': keepalive\n\n');
    }, 25000).unref();
    server.listen(PORT, HOST, () => {
      console.log(`Vibe Coding Command Center: http://${HOST}:${PORT}`);
      console.log(`Worktrees: ${worktrees.map((w) => w.path).join(', ') || 'none'}`);
    });
  });

export { resolveSpecFile };
