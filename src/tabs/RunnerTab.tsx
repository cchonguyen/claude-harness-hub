import React from 'react';
import {
  Terminal,
  Play,
  Check,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  ShieldAlert
} from 'lucide-react';
import {
  RunnerClassification,
  TestRunRecord,
  AllowListedCommandId
} from '../types';

interface RunnerTabProps {
  testCmdInput: string;
  classification: RunnerClassification | null;
  lastTestRun: TestRunRecord | null;
  runningTests: boolean;
  copiedText: string | null;
  onChangeCmdInput: (cmd: string) => void;
  onRunAllowListed: (cmdId: AllowListedCommandId) => void;
  onCopy: (text: string, id: string) => void;
}

const ALLOW_LISTED_COMMANDS: Array<{
  id: AllowListedCommandId;
  title: string;
  command: string;
}> = [
  {
    id: 'unit-tests',
    title: 'Run Harness Unit Tests',
    command: 'node --test .harness/hooks/lib/runner-matcher.test.mjs'
  },
  {
    id: 'typecheck',
    title: 'Run Typecheck',
    command: 'npm run typecheck --silent'
  },
  {
    id: 'lint',
    title: 'Run Lint',
    command: 'npm run lint --silent'
  }
];

export default function RunnerTab({
  testCmdInput,
  classification,
  lastTestRun,
  runningTests,
  copiedText,
  onChangeCmdInput,
  onRunAllowListed,
  onCopy
}: RunnerTabProps) {
  const matchedAllowList = ALLOW_LISTED_COMMANDS.find(
    (item) => item.command.toLowerCase() === testCmdInput.trim().toLowerCase()
  );

  return (
    <div className="space-y-6">
      {/* Section 1: Regex Classifier Only */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Runner Matcher Classifier Probe
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-700/50 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                CLASSIFIES ONLY — DOES NOT EXECUTE ARBITRARY INPUT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulates how <code className="text-indigo-300 font-mono">runner-matcher.mjs</code>{' '}
              categorizes a command string. Typing here only evaluates regex rules; use the
              allow-listed runner buttons below to execute real checks.
            </p>
          </div>
        </div>

        {/* Command input */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={testCmdInput}
                onChange={(e) => onChangeCmdInput(e.target.value)}
                aria-label="Command string to classify"
                placeholder="Classify a command string (e.g. npm test, vitest run, ruff check --quiet)..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {matchedAllowList && (
              <button
                type="button"
                onClick={() => onRunAllowListed(matchedAllowList.id)}
                disabled={runningTests}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Execute (Allow-Listed)
              </button>
            )}
          </div>

          {/* Pre-populated sample pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-500 font-mono">Classify Presets:</span>
            {[
              'npx vitest run --reporter=dot',
              'pytest -q --tb=short',
              'npm test',
              'node --test .harness/hooks/lib/runner-matcher.test.mjs',
              'pnpm run build',
              'ruff check --quiet',
              'npx eslint .',
              'npm run typecheck --silent',
              'npm install',
              'cat test.txt'
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChangeCmdInput(preset)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Classification Result Card */}
        {classification && (
          <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Runner Match:</span>
                {classification.isTestOrBuild ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> MATCHED
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-700 font-medium">
                    NOT A RUNNER
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  Advances Green Checkpoint:
                </span>
                {classification.advancesGreen ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 font-medium flex items-center gap-1">
                    <BookmarkCheck className="w-3 h-3" /> YES (ADVANCES)
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 font-medium">
                    NO (NEVER ADVANCES)
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans border-t border-slate-800/80 pt-2">
              <span className="text-slate-500 font-mono mr-1">Rule:</span>
              {classification.reason}
            </p>
          </div>
        )}
      </div>

      {/* Section 2: Allow-Listed Command Runner (CLAUDE.md Verification Suite) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              Allow-Listed Verification Runner (execFile, Zero Shell Interpolation)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Executes the 3 allow-listed <code className="text-indigo-300 font-mono">CLAUDE.md</code>{' '}
              verification commands on the server and keeps the last result, timestamp, and output
              across page refreshes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ALLOW_LISTED_COMMANDS.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200">{item.title}</div>
                <code className="text-[11px] font-mono text-indigo-300 block mt-1 break-all">
                  {item.command}
                </code>
              </div>
              <button
                type="button"
                onClick={() => onRunAllowListed(item.id)}
                disabled={runningTests}
                className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
                {runningTests ? 'Running...' : `Run ${item.title.replace('Run ', '')}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Persistent Last Test Result & Output */}
      {lastTestRun ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {lastTestRun.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="text-xs font-semibold text-slate-200 font-mono">
                {lastTestRun.commandLabel}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  lastTestRun.success
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700/50'
                }`}
              >
                {lastTestRun.success ? 'PASSED' : 'FAILED'} ({lastTestRun.durationMs}ms)
              </span>
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                Ran at {new Date(lastTestRun.ranAt).toLocaleString()} (persisted across refresh)
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onCopy(
                  `${lastTestRun.stdout}${lastTestRun.stderr ? `\n${lastTestRun.stderr}` : ''}`,
                  'test-res'
                )
              }
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 self-end sm:self-auto cursor-pointer"
            >
              {copiedText === 'test-res' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy Output
            </button>
          </div>
          <pre
            className={`p-4 bg-slate-950 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ${
              lastTestRun.success ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {lastTestRun.stdout}
            {lastTestRun.stderr ? `\n${lastTestRun.stderr}` : ''}
          </pre>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 text-center text-xs font-mono text-slate-400">
          No verification command has been executed yet. Click one of the allow-listed commands
          above to run it and persist its output across page refreshes.
        </div>
      )}
    </div>
  );
}
