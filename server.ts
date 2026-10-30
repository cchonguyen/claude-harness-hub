import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Helper to safely read file
const readSafe = (relPath: string): string => {
  const p = path.join(root, relPath);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
};

const getMtimeIso = (relPath: string): string | null => {
  const p = path.join(root, relPath);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.statSync(p).mtime.toISOString();
  } catch {
    return null;
  }
};

// Runner matching regexes (exact mirror of .harness/hooks/lib/runner-matcher.mjs)
const RUNNER =
  /\b(vitest|jest|tsc|eslint|typecheck|pytest|mypy|pyright)\b|\bruff\s+(check|format\s+--check)\b|\bnode\s+--test\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|typecheck)\b/i;
const EXECUTES =
  /\b(vitest|jest|pytest)\b|\bnode\s+--test\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build)\b/i;
const INSTALL = /\b(pip3?|uv\s+pip|uv|npm|pnpm|yarn|bun)\s+(install|add|i|sync)\b/i;

const isTestOrBuild = (cmd: string): boolean => RUNNER.test(cmd) && !INSTALL.test(cmd);
const advancesGreen = (cmd: string): boolean => EXECUTES.test(cmd) && !INSTALL.test(cmd);

// Mode parsing helper
const getMode = () => {
  const progress = readSafe('.spec/PROGRESS.md');
  const ACTIVE_TASK = /^\s*-\s*\[.\].*\[IN_PROGRESS\]/;
  const lines = progress.split('\n');
  const activeLines = lines.filter((l) => ACTIVE_TASK.test(l));
  const activeCount = activeLines.length;

  let mode: 'vibe' | 'slice' | 'conflict' = 'vibe';
  if (activeCount === 1) mode = 'slice';
  else if (activeCount > 1) mode = 'conflict';

  return { mode, activeCount, activeLines };
};

// Parse .spec/SESSION_HANDOFF.md into structured fields
const parseSessionHandoff = () => {
  const raw = readSafe('.spec/SESSION_HANDOFF.md');
  const updatedAt = getMtimeIso('.spec/SESSION_HANDOFF.md');

  const extractField = (labels: string[], fallback: string): string => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^\\s*-\\s*\\*\\*${escaped}:?\\*\\*:?\\s*(.+)$`, 'im');
      const match = raw.match(re);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return fallback;
  };

  let lastPlatform = extractField(['Last Active Platform'], '');
  if (!lastPlatform) {
    if (/Updated by Google AI Studio/i.test(raw)) {
      lastPlatform = 'Google AI Studio';
    } else if (/Claude Code/i.test(raw)) {
      lastPlatform = 'Claude Code';
    } else {
      lastPlatform = 'Unknown';
    }
  }

  const activeBranchState = extractField(['Active Branch / State', 'Branch / State'], 'Not recorded');
  const filesModified = extractField(
    ['Files Modified in Last Turn', 'Files Modified by AI Studio', 'Files Modified'],
    'None listed'
  );
  const verificationStatus = extractField(['Verification Status'], 'Unverified');
  const immediateNextStep = extractField(
    ['Immediate Next Step', 'Immediate Next Step for Claude'],
    'Review .spec/PROGRESS.md for the next slice'
  );
  const activeSlice = extractField(['Active Slice'], 'none (Vibe Mode)');

  return {
    lastPlatform,
    activeBranchState,
    filesModified,
    verificationStatus,
    immediateNextStep,
    activeSlice,
    updatedAt
  };
};

// Parse included files from HANDOFF_PACKET.md content
const parsePacketMetadata = (content: string) => {
  if (!content) {
    return { mode: 'spec' as const, includedFiles: [] as string[] };
  }
  const isDiff = content.includes('# GIT DIFF') || content.startsWith('@code-reviewer');
  const included: string[] = [];

  if (isDiff) {
    included.push('.spec/SYSTEM_SPEC.md', '.spec/PROGRESS.md');
    const diffMatches = content.matchAll(/^\+\+\+\s+b\/(.+)$/gm);
    for (const m of diffMatches) {
      const file = m[1].trim();
      if (file && !included.includes(file)) {
        included.push(file);
      }
    }
  } else {
    included.push('.spec/OVERVIEW.md', '.spec/SYSTEM_SPEC.md', '.spec/PROGRESS.md');
    const refMatches = content.matchAll(/^## Reference:\s+(.+)$/gm);
    for (const m of refMatches) {
      const file = m[1].trim();
      if (file && !included.includes(file)) {
        included.push(file);
      }
    }
  }

  return {
    mode: isDiff ? ('diff' as const) : ('spec' as const),
    includedFiles: included
  };
};

const getHandoffStateSnapshot = (lastReceipt: string | null = null, requestedMode?: string) => {
  const packetRel = '.spec/HANDOFF_PACKET.md';
  const packetAbs = path.join(root, packetRel);
  const exists = fs.existsSync(packetAbs);
  const packetContent = exists ? fs.readFileSync(packetAbs, 'utf8') : '';
  const packetMtime = getMtimeIso(packetRel);
  const progressMtime = getMtimeIso('.spec/PROGRESS.md');
  const { mode: detectedMode, includedFiles } = parsePacketMetadata(packetContent);

  let isStale = false;
  let staleReason: string | null = null;
  if (exists && packetMtime && progressMtime) {
    const packetTime = new Date(packetMtime).getTime();
    const progressTime = new Date(progressMtime).getTime();
    // Allow 500ms filesystem jitter when bundle-handoff just read PROGRESS.md
    if (progressTime > packetTime + 500) {
      isStale = true;
      staleReason = `.spec/PROGRESS.md was modified after this packet was built (${new Date(
        progressMtime
      ).toLocaleTimeString()} > ${new Date(packetMtime).toLocaleTimeString()}). Rebuild before copying.`;
    }
  }

  return {
    exists,
    mode: (requestedMode || detectedMode) as 'spec' | 'diff' | 'arch' | 'overview',
    receipt: lastReceipt,
    packetContent,
    lineCount: packetContent ? packetContent.split('\n').length : 0,
    includedFiles,
    packetMtime,
    progressMtime,
    isStale,
    staleReason
  };
};

let lastHandoffReceipt: string | null = null;

// 1. Status API
app.get('/api/status', (req, res) => {
  try {
    const version = readSafe('.harness-version').trim() || '2.2.0';
    let hubConfig = { repo: 'claude-harness-hub', owner: 'cchonguyen', branch: 'main' };
    try {
      hubConfig = { ...hubConfig, ...JSON.parse(readSafe('.harness/hub.json') || '{}') };
    } catch {}

    const { mode, activeCount, activeLines } = getMode();

    let checkpoints: Record<string, any> = {};
    try {
      checkpoints = JSON.parse(readSafe('.spec/.vibe-checkpoint.json') || '{}');
    } catch {}

    let strikes: Record<string, any> = {};
    try {
      strikes = JSON.parse(readSafe('.spec/.strike-counter.json') || '{}');
    } catch {}

    const hasSliceCheckpoint = fs.existsSync(path.join(root, '.spec', '.slice-checkpoint'));
    const progressMtime = getMtimeIso('.spec/PROGRESS.md');
    const sessionHandoff = parseSessionHandoff();

    res.json({
      version,
      hubConfig,
      mode,
      activeCount,
      activeLines,
      hasSliceCheckpoint,
      checkpoints,
      strikes,
      root,
      progressMtime,
      sessionHandoff
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Spec Files API with Ownership Metadata
const SPEC_FILE_META: Record<
  string,
  { ownership: 'editable' | 'template' | 'harness-owned'; ownershipLabel: string; readOnly: boolean }
> = {
  '.spec/PROGRESS.md': {
    ownership: 'editable',
    ownershipLabel: 'Editable (Project-Owned)',
    readOnly: false
  },
  '.spec/OVERVIEW.md': {
    ownership: 'editable',
    ownershipLabel: 'Editable (Project-Owned)',
    readOnly: false
  },
  '.spec/SYSTEM_SPEC.md': {
    ownership: 'editable',
    ownershipLabel: 'Editable (Project-Owned)',
    readOnly: false
  },
  '.spec/DECISIONS.md': {
    ownership: 'editable',
    ownershipLabel: 'Editable (Project-Owned)',
    readOnly: false
  },
  '.spec/SESSION_HANDOFF.md': {
    ownership: 'editable',
    ownershipLabel: 'Editable (Project-Owned)',
    readOnly: false
  },
  'CLAUDE.md': {
    ownership: 'editable',
    ownershipLabel: 'Editable (Project-Owned)',
    readOnly: false
  },
  '.spec/AI_STUDIO_RULES.md': {
    ownership: 'template',
    ownershipLabel: 'Editable (Spoke Template — preserved on sync)',
    readOnly: false
  },
  '.claude/harness-rules.md': {
    ownership: 'harness-owned',
    ownershipLabel: 'Harness-Owned (Read-Only Engine File — synced via /learn)',
    readOnly: true
  }
};

const SPEC_FILE_PATHS = Object.keys(SPEC_FILE_META);

app.get('/api/spec-files', (req, res) => {
  try {
    const files = SPEC_FILE_PATHS.map((rel) => {
      const abs = path.join(root, rel);
      const exists = fs.existsSync(abs);
      let content = '';
      let mtime: string | null = null;
      let size = 0;
      let lineCount = 0;

      if (exists) {
        content = fs.readFileSync(abs, 'utf8');
        const stats = fs.statSync(abs);
        mtime = stats.mtime.toISOString();
        size = stats.size;
        lineCount = content.split('\n').length;
      }

      const meta = SPEC_FILE_META[rel];

      return {
        path: rel,
        exists,
        content,
        mtime,
        size,
        lineCount,
        ownership: meta.ownership,
        ownershipLabel: meta.ownershipLabel,
        readOnly: meta.readOnly
      };
    });

    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/spec-file', (req, res) => {
  try {
    const { filePath, content } = req.body;
    const meta = SPEC_FILE_META[filePath];
    if (!meta) {
      return res
        .status(403)
        .json({ error: 'Modification restricted to registered spec & contract files' });
    }
    if (meta.readOnly) {
      return res
        .status(403)
        .json({ error: `${filePath} is harness-owned and protected from direct edits.` });
    }

    const abs = path.join(root, filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');

    res.json({ success: true, message: `Updated ${filePath}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Progress Slice Toggle API
app.post('/api/progress/slice-action', (req, res) => {
  try {
    const { action, sliceIndex, newSlice } = req.body;
    const progressPath = path.join(root, '.spec', 'PROGRESS.md');
    const content = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8') : '';
    let lines = content.split('\n');

    const sliceRegex = /^(\s*-\s*\[)([ xX])(\]\s*\*\*Slice\s+([^:*]+)\*\*.*)$/;

    if (action === 'activate') {
      lines = lines.map((line) => {
        if (line.includes('[IN_PROGRESS]')) {
          return line.replace(/\s*\[IN_PROGRESS\]/, '');
        }
        return line;
      });

      let currentSliceIdx = 0;
      lines = lines.map((line) => {
        if (sliceRegex.test(line)) {
          if (currentSliceIdx === sliceIndex) {
            line = line.replace(/^(\s*-\s*\[)[ xX](\])/, '$1 $2');
            if (!line.includes('[IN_PROGRESS]')) {
              if (line.includes('— Target files:')) {
                line = line.replace('— Target files:', '[IN_PROGRESS] — Target files:');
              } else {
                line = `${line} [IN_PROGRESS]`;
              }
            }
          }
          currentSliceIdx++;
        }
        return line;
      });
    } else if (action === 'complete') {
      let currentSliceIdx = 0;
      lines = lines.map((line) => {
        if (sliceRegex.test(line)) {
          if (currentSliceIdx === sliceIndex) {
            line = line.replace(/^(\s*-\s*\[)[ xX](\])/, '$1x$2');
            line = line.replace(/\s*\[IN_PROGRESS\]/, '');
          }
          currentSliceIdx++;
        }
        return line;
      });
    } else if (action === 'uncheck') {
      let currentSliceIdx = 0;
      lines = lines.map((line) => {
        if (sliceRegex.test(line)) {
          if (currentSliceIdx === sliceIndex) {
            line = line.replace(/^(\s*-\s*\[)[ xX](\])/, '$1 $2');
            line = line.replace(/\s*\[IN_PROGRESS\]/, '');
          }
          currentSliceIdx++;
        }
        return line;
      });
    } else if (action === 'clear-all') {
      lines = lines.map((line) => line.replace(/\s*\[IN_PROGRESS\]/, ''));
    } else if (action === 'add') {
      const tag = newSlice.isCore ? '[CORE / DATA]' : '[UI / VISUAL]';
      const newLine = `- [ ] **Slice ${newSlice.number}** \`${tag}\`: ${newSlice.description} — Target files: ${newSlice.targetFiles}`;
      lines.push(newLine);
    }

    const nextContent = lines.join('\n');
    fs.writeFileSync(progressPath, nextContent, 'utf8');

    const updatedMode = getMode();
    res.json({ success: true, updatedMode, content: nextContent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Agents API
app.get('/api/agents', (req, res) => {
  try {
    const agentsDir = path.join(root, '.claude', 'agents');
    if (!fs.existsSync(agentsDir)) return res.json({ agents: [] });

    const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
    const agents = files.map((file) => {
      const raw = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const metadata: Record<string, string> = {};
      let body = raw;

      if (frontmatterMatch) {
        const lines = frontmatterMatch[1].split('\n');
        for (const line of lines) {
          const [key, ...vals] = line.split(':');
          if (key && vals.length) {
            metadata[key.trim()] = vals.join(':').trim();
          }
        }
        body = frontmatterMatch[2].trim();
      }

      return {
        id: file.replace('.md', ''),
        file,
        name: metadata.name || file.replace('.md', ''),
        description: metadata.description || '',
        model: metadata.model || 'sonnet',
        tools: metadata.tools || '',
        body
      };
    });

    res.json({ agents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Commands API
app.get('/api/commands', (req, res) => {
  try {
    const commandsDir = path.join(root, '.claude', 'commands');
    if (!fs.existsSync(commandsDir)) return res.json({ commands: [] });

    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
    const commands = files.map((file) => {
      const raw = fs.readFileSync(path.join(commandsDir, file), 'utf8');
      const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const metadata: Record<string, any> = {};
      let body = raw;

      if (frontmatterMatch) {
        const lines = frontmatterMatch[1].split('\n');
        for (const line of lines) {
          const [key, ...vals] = line.split(':');
          if (key && vals.length) {
            metadata[key.trim()] = vals.join(':').trim();
          }
        }
        body = frontmatterMatch[2].trim();
      }

      return {
        id: file.replace('.md', ''),
        name: `/${file.replace('.md', '')}`,
        description: metadata.description || '',
        argumentHint: metadata['argument-hint'] || '',
        allowedTools: metadata['allowed-tools'] || '',
        disableModelInvocation: metadata['disable-model-invocation'] === 'true',
        body
      };
    });

    res.json({ commands });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Settings & Security API
app.get('/api/settings', (req, res) => {
  try {
    const raw = readSafe('.claude/settings.json');
    const settings = raw ? JSON.parse(raw) : {};
    res.json({ settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Runner Matcher Classifier API
app.post('/api/runner/classify', (req, res) => {
  try {
    const { command } = req.body;
    if (typeof command !== 'string') {
      return res.status(400).json({ error: 'Command string required' });
    }

    const testOrBuild = isTestOrBuild(command);
    const executes = advancesGreen(command);

    let reason = '';
    if (!testOrBuild) {
      if (INSTALL.test(command)) {
        reason = 'Matches package install/sync command — does not count as test/build runner';
      } else {
        reason = 'Does not match test, build, lint, or typecheck patterns';
      }
    } else if (executes) {
      reason =
        'Executes code (test or build) — advances the Vibe Mode "last known green" checkpoint';
    } else {
      reason =
        'Static analysis only (lint or typecheck) — counts as a run for circuit breaker, but NEVER advances green checkpoint';
    }

    res.json({
      command,
      isTestOrBuild: testOrBuild,
      advancesGreen: executes,
      reason
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Allow-Listed Command & Test Runner API with Persistence
const ALLOWED_RUNNER_COMMANDS: Record<
  'unit-tests' | 'typecheck' | 'lint',
  { bin: string; args: string[]; label: string }
> = {
  'unit-tests': {
    bin: 'node',
    args: ['--test', '.harness/hooks/lib/runner-matcher.test.mjs'],
    label: 'node --test .harness/hooks/lib/runner-matcher.test.mjs'
  },
  typecheck: {
    bin: 'npm',
    args: ['run', 'typecheck', '--silent'],
    label: 'npm run typecheck --silent'
  },
  lint: {
    bin: 'npm',
    args: ['run', 'lint', '--silent'],
    label: 'npm run lint --silent'
  }
};

let lastTestRunRecord: {
  commandId: 'unit-tests' | 'typecheck' | 'lint';
  commandLabel: string;
  success: boolean;
  stdout: string;
  stderr?: string;
  durationMs: number;
  ranAt: string;
} | null = null;

app.get('/api/tests/last', (req, res) => {
  res.json({ lastRun: lastTestRunRecord });
});

app.post('/api/tests/run', async (req, res) => {
  const requestedId = req.body?.commandId || 'unit-tests';
  if (!(requestedId in ALLOWED_RUNNER_COMMANDS)) {
    return res.status(400).json({
      error: 'Command not in allow-list. Allowed: unit-tests, typecheck, lint'
    });
  }
  const cmdId = requestedId as 'unit-tests' | 'typecheck' | 'lint';
  const spec = ALLOWED_RUNNER_COMMANDS[cmdId];
  const start = Date.now();
  const ranAt = new Date().toISOString();

  try {
    const { stdout, stderr } = await execFileAsync(spec.bin, spec.args, { cwd: root });
    const durationMs = Date.now() - start;
    const output = (stdout || stderr || 'Passed (0 errors, silent output)').trim();
    lastTestRunRecord = {
      commandId: cmdId,
      commandLabel: spec.label,
      success: true,
      stdout: output,
      durationMs,
      ranAt
    };
    res.json(lastTestRunRecord);
  } catch (error: any) {
    const durationMs = Date.now() - start;
    lastTestRunRecord = {
      commandId: cmdId,
      commandLabel: spec.label,
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      durationMs,
      ranAt
    };
    res.json(lastTestRunRecord);
  }
});

// 9. Bundle Handoff Generator & State API
const ALLOWED_HANDOFF_MODES = new Set(['spec', 'diff', 'arch', 'overview']);

app.get('/api/handoff-state', (req, res) => {
  try {
    res.json(getHandoffStateSnapshot(lastHandoffReceipt));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bundle-handoff', async (req, res) => {
  try {
    const mode = typeof req.body?.mode === 'string' ? req.body.mode.toLowerCase() : 'spec';
    if (!ALLOWED_HANDOFF_MODES.has(mode)) {
      return res
        .status(400)
        .json({ error: 'Invalid mode. Allowed values: spec, diff, arch, overview' });
    }
    const scriptPath = path.join(root, '.harness', 'scripts', 'bundle-handoff.mjs');
    const { stdout, stderr } = await execFileAsync('node', [scriptPath, mode], { cwd: root });
    lastHandoffReceipt = stdout.trim() || stderr.trim();
    const state = getHandoffStateSnapshot(lastHandoffReceipt, mode);

    res.json({
      success: true,
      ...state
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stderr: error.stderr });
  }
});

// 10. Spoke Connection & Engine File Match / Dry-Run API
const walkFilesRelative = (baseDir: string, relTarget: string): string[] => {
  const fullTarget = path.join(baseDir, relTarget);
  if (!fs.existsSync(fullTarget)) return [];
  const stat = fs.statSync(fullTarget);
  if (stat.isFile()) return [relTarget];

  const results: string[] = [];
  const walk = (currentAbs: string) => {
    const entries = fs.readdirSync(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      const nextAbs = path.join(currentAbs, entry.name);
      if (entry.isDirectory()) {
        walk(nextAbs);
      } else if (entry.isFile()) {
        results.push(path.relative(baseDir, nextAbs).split(path.sep).join('/'));
      }
    }
  };
  walk(fullTarget);
  return results;
};

app.get('/api/spoke-status', (req, res) => {
  try {
    let hubConfig = { repo: 'claude-harness-hub', owner: 'cchonguyen', branch: 'main' };
    try {
      hubConfig = { ...hubConfig, ...JSON.parse(readSafe('.harness/hub.json') || '{}') };
    } catch {}

    const ENGINE_PATHS = ['.claude', '.harness', '.harness-version'];
    const TEMPLATE_PATHS = ['.spec/AI_STUDIO_RULES.md'];

    // Look for a sibling hub checkout first (mirrors hub-sync.mjs findSibling)
    const candidates = [process.env.HARNESS_HUB_DIR, path.join(root, '..', hubConfig.repo)].filter(
      Boolean
    ) as string[];
    const parent = path.dirname(root);
    try {
      for (const d of fs.readdirSync(parent, { withFileTypes: true })) {
        if (d.isDirectory()) candidates.push(path.join(parent, d.name));
      }
    } catch {}

    const siblingHub = candidates
      .map((c) => path.resolve(c))
      .find(
        (c) =>
          c !== path.resolve(root) &&
          fs.existsSync(path.join(c, '.harness')) &&
          path.basename(c) === hubConfig.repo
      );

    // Check if current repo is the hub repo itself
    let pkgName = '';
    try {
      pkgName = JSON.parse(readSafe('package.json') || '{}').name || '';
    } catch {}
    const isHubRepo =
      !siblingHub &&
      (path.basename(root) === hubConfig.repo || pkgName === hubConfig.repo) &&
      fs.existsSync(path.join(root, '.harness', 'scripts', 'hub-sync.mjs'));

    const compareSourceDir = siblingHub || (isHubRepo ? root : null);
    const hubAttached = Boolean(siblingHub || isHubRepo);
    const attachMethod = siblingHub
      ? 'sibling'
      : isHubRepo
      ? 'self-hub'
      : 'unattached';

    const differences: Array<{
      path: string;
      status:
        | 'identical'
        | 'modified'
        | 'missing-in-spoke'
        | 'extra-in-spoke'
        | 'template-preserved'
        | 'template-missing';
    }> = [];

    if (compareSourceDir) {
      const hubFiles = new Set<string>();
      const localFiles = new Set<string>();

      for (const rel of ENGINE_PATHS) {
        walkFilesRelative(compareSourceDir, rel).forEach((f) => hubFiles.add(f));
        walkFilesRelative(root, rel).forEach((f) => localFiles.add(f));
      }

      const allEngineFiles = Array.from(new Set([...hubFiles, ...localFiles])).sort();
      for (const relFile of allEngineFiles) {
        const inHub = hubFiles.has(relFile);
        const inLocal = localFiles.has(relFile);
        if (inHub && !inLocal) {
          differences.push({ path: relFile, status: 'missing-in-spoke' });
        } else if (!inHub && inLocal) {
          differences.push({ path: relFile, status: 'extra-in-spoke' });
        } else {
          const hubBuf = fs.readFileSync(path.join(compareSourceDir, relFile));
          const localBuf = fs.readFileSync(path.join(root, relFile));
          if (hubBuf.equals(localBuf)) {
            differences.push({ path: relFile, status: 'identical' });
          } else {
            differences.push({ path: relFile, status: 'modified' });
          }
        }
      }

      for (const tpl of TEMPLATE_PATHS) {
        const localExists = fs.existsSync(path.join(root, tpl));
        differences.push({
          path: tpl,
          status: localExists ? 'template-preserved' : 'template-missing'
        });
      }
    }

    const driftCount = differences.filter(
      (d) =>
        d.status === 'modified' ||
        d.status === 'missing-in-spoke' ||
        d.status === 'template-missing'
    ).length;

    const engineMatches = hubAttached && driftCount === 0;
    const summary = !hubAttached
      ? `HUB_NOT_ATTACHED: No checkout of ${hubConfig.owner}/${hubConfig.repo} found at ../${hubConfig.repo} or HARNESS_HUB_DIR.`
      : isHubRepo
      ? `This workspace is the authoritative ${hubConfig.repo} hub (${differences.length} engine & template files verified intact).`
      : engineMatches
      ? `Spoke engine files match attached hub at ${siblingHub} (${differences.length} files verified).`
      : `Dry-run detected ${driftCount} file(s) that will be updated or added on sync from ${siblingHub}.`;

    res.json({
      isHubRepo,
      hubAttached,
      attachMethod,
      hubPath: compareSourceDir,
      hubConfig,
      engineMatches,
      filesChecked: differences.length,
      differences,
      summary,
      checkedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend in production or mount Vite middleware in development
const HOST = process.env.HOST || '127.0.0.1';

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: HOST, port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Claude Harness Hub] Server active on http://${HOST}:${PORT}`);
  });
}

startServer();
