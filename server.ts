import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
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

// Runner matching regexes (exact mirror of .harness/hooks/lib/runner-matcher.mjs)
const RUNNER = /\b(vitest|jest|tsc|eslint|typecheck|pytest|mypy|pyright)\b|\bruff\s+(check|format\s+--check)\b|\bnode\s+--test\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|typecheck)\b/i;
const EXECUTES = /\b(vitest|jest|pytest)\b|\bnode\s+--test\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build)\b/i;
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

    res.json({
      version,
      hubConfig,
      mode,
      activeCount,
      activeLines,
      hasSliceCheckpoint,
      checkpoints,
      strikes,
      root
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Spec Files API
const SPEC_FILE_PATHS = [
  '.spec/PROGRESS.md',
  '.spec/OVERVIEW.md',
  '.spec/SYSTEM_SPEC.md',
  '.spec/DECISIONS.md',
  '.spec/SESSION_HANDOFF.md',
  '.spec/AI_STUDIO_RULES.md',
  'CLAUDE.md',
  '.claude/harness-rules.md'
];

app.get('/api/spec-files', (req, res) => {
  try {
    const files = SPEC_FILE_PATHS.map((rel) => {
      const abs = path.join(root, rel);
      const exists = fs.existsSync(abs);
      let content = '';
      let mtime = null;
      let size = 0;
      let lineCount = 0;

      if (exists) {
        content = fs.readFileSync(abs, 'utf8');
        const stats = fs.statSync(abs);
        mtime = stats.mtime;
        size = stats.size;
        lineCount = content.split('\n').length;
      }

      return {
        path: rel,
        exists,
        content,
        mtime,
        size,
        lineCount
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
    if (!SPEC_FILE_PATHS.includes(filePath)) {
      return res.status(403).json({ error: 'Modification restricted to registered spec & contract files' });
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
    let content = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8') : '';
    let lines = content.split('\n');

    const sliceRegex = /^(\s*-\s*\[)([ xX])(\]\s*\*\*Slice\s+([^:*]+)\*\*.*)$/;

    if (action === 'activate') {
      // Deactivate any currently active slice first (Single-Slice Lock)
      lines = lines.map((line) => {
        if (line.includes('[IN_PROGRESS]')) {
          return line.replace(/\s*\[IN_PROGRESS\]/, '');
        }
        return line;
      });

      // Activate the targeted slice
      let currentSliceIdx = 0;
      lines = lines.map((line) => {
        if (sliceRegex.test(line)) {
          if (currentSliceIdx === sliceIndex) {
            // Ensure unchecked and append [IN_PROGRESS]
            line = line.replace(/^(\s*-\s*\[)[ xX](\])/, '$1 $2');
            if (!line.includes('[IN_PROGRESS]')) {
              // Place [IN_PROGRESS] after task title/tag or before Target files
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
      // Clear all IN_PROGRESS to return to Vibe Mode
      lines = lines.map((line) => line.replace(/\s*\[IN_PROGRESS\]/, ''));
    } else if (action === 'add') {
      // Add new slice line
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
      let metadata: Record<string, string> = {};
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
      let metadata: Record<string, any> = {};
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
      reason = 'Executes code (test or build) — advances the Vibe Mode "last known green" checkpoint';
    } else {
      reason = 'Static analysis only (lint or typecheck) — counts as a run for circuit breaker, but NEVER advances green checkpoint';
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

// 8. Test Runner API
app.post('/api/tests/run', async (req, res) => {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync('node --test .harness/hooks/lib/runner-matcher.test.mjs', { cwd: root });
    const durationMs = Date.now() - start;
    res.json({
      success: true,
      stdout: stdout || stderr,
      durationMs
    });
  } catch (error: any) {
    const durationMs = Date.now() - start;
    res.json({
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      durationMs
    });
  }
});

// 9. Bundle Handoff Generator API
app.post('/api/bundle-handoff', async (req, res) => {
  try {
    const mode = req.body.mode || 'spec';
    const scriptPath = path.join(root, '.harness', 'scripts', 'bundle-handoff.mjs');
    const { stdout, stderr } = await execAsync(`node "${scriptPath}" ${mode}`, { cwd: root });
    const packetContent = readSafe('.spec/HANDOFF_PACKET.md');

    res.json({
      success: true,
      receipt: stdout.trim() || stderr.trim(),
      packetContent,
      lineCount: packetContent.split('\n').length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stderr: error.stderr });
  }
});

// Serve frontend in production or mount Vite middleware in development
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
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Claude Harness Hub] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
