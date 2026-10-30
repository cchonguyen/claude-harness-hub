import React from 'react';
import {
  Terminal,
  Play,
  Check,
  BookmarkCheck,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { RunnerClassification } from '../types';

interface RunnerTabProps {
  testCmdInput: string;
  classification: RunnerClassification | null;
  testOutput: string | null;
  runningTests: boolean;
  copiedText: string | null;
  onChangeCmdInput: (cmd: string) => void;
  onRunTests: () => void;
  onCopy: (text: string, id: string) => void;
}

export default function RunnerTab({
  testCmdInput,
  classification,
  testOutput,
  runningTests,
  copiedText,
  onChangeCmdInput,
  onRunTests,
  onCopy
}: RunnerTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              Runner Matcher Classifier Probe
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Simulate how <code className="text-indigo-300 font-mono">runner-matcher.mjs</code> categorizes shell commands. Test whether a command counts as a test/build runner and whether it can advance the Vibe Mode checkpoint.
            </p>
          </div>

          <button
            onClick={onRunTests}
            disabled={runningTests}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-sm transition-all"
          >
            <Play className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
            {runningTests ? 'Executing Harness Tests...' : 'Run Harness Unit Tests'}
          </button>
        </div>

        {/* Command input */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={testCmdInput}
                onChange={(e) => onChangeCmdInput(e.target.value)}
                placeholder="Classify a command (does not run it), e.g. npm test, vitest run, ruff check --quiet..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Pre-populated sample pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-500 font-mono">Presets:</span>
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
                onClick={() => onChangeCmdInput(preset)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
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
                <span className="text-xs text-slate-400 font-mono">Advances Green Checkpoint:</span>
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

      {/* Test Run Output */}
      {testOutput && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200 font-mono">
                Test Runner Result: node --test .harness/hooks/lib/runner-matcher.test.mjs
              </span>
            </div>
            <button
              onClick={() => onCopy(testOutput, 'test-res')}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
            >
              {copiedText === 'test-res' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copy
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
            {testOutput}
          </pre>
        </div>
      )}
    </div>
  );
}
