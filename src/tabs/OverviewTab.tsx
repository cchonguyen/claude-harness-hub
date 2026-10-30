import React from 'react';
import {
  Shield,
  Terminal,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Plus,
  Lock,
  Unlock,
  Flame,
  BookmarkCheck
} from 'lucide-react';
import { HarnessStatus, ParsedSlice, SliceActionType } from '../types';

interface OverviewTabProps {
  status: HarnessStatus | null;
  agentsCount: number;
  commandsCount: number;
  parsedSlices: ParsedSlice[];
  copiedText: string | null;
  onCopy: (text: string, id: string) => void;
  onSliceAction: (action: SliceActionType, sliceIndex?: number) => void;
  onOpenAddSliceModal: () => void;
}

export default function OverviewTab({
  status,
  agentsCount,
  commandsCount,
  parsedSlices,
  copiedText,
  onCopy,
  onSliceAction,
  onOpenAddSliceModal
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Top State Alert Banner */}
      <div className={`p-4 rounded-xl border ${
        status?.mode === 'vibe'
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
          : status?.mode === 'slice'
          ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
          : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              status?.mode === 'vibe' ? 'bg-emerald-500/20 text-emerald-400' :
              status?.mode === 'slice' ? 'bg-indigo-500/20 text-indigo-400' :
              'bg-rose-500/20 text-rose-400'
            }`}>
              {status?.mode === 'vibe' ? <Unlock className="w-5 h-5" /> :
               status?.mode === 'slice' ? <Lock className="w-5 h-5" /> :
               <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {status?.mode === 'vibe' && 'Active Engine State: VIBE MODE (No Slice Lock)'}
                {status?.mode === 'slice' && 'Active Engine State: SLICE MODE (Single-Task Scope Lock)'}
                {status?.mode === 'conflict' && 'Active Engine State: CONFLICT (Multiple Slices In Progress)'}
              </h3>
              <p className="text-xs mt-1 text-slate-300/80 leading-relaxed max-w-3xl">
                {status?.mode === 'vibe' &&
                  'You are in Vibe Mode. Edit requested files freely without /triage or /spec ceremony. The harness automatically snapshots session baselines and advances the "last known green" checkpoint when tests/builds pass.'}
                {status?.mode === 'slice' &&
                  `Single-slice lock is strictly enforced. The active slice is: ${status.activeLines[0] || ''}. Pre-tool guard blocks modifications to files outside its declared target boundaries.`}
                {status?.mode === 'conflict' &&
                  'Work lock violation! More than 1 task line in .spec/PROGRESS.md contains [IN_PROGRESS]. Tool writes are blocked until only 1 slice is active, or all are cleared.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {status?.mode !== 'vibe' && (
              <button
                onClick={() => onSliceAction('clear-all')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
              >
                Switch to Vibe Mode
              </button>
            )}
            <button
              onClick={onOpenAddSliceModal}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New Slice
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">Harness Version</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">v{status?.version || '2.2.0'}</div>
          <div className="text-[11px] text-slate-400 mt-1">Zero-dependency engine</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">Circuit Breaker</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {Object.values(status?.strikes || {})[0]?.strikes || 0} / 2
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Identical failure strikes</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">Vibe Checkpoint</span>
            <BookmarkCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-white font-mono truncate">
            {Object.values(status?.checkpoints || {})[0]?.sha ? (
              <span className="text-emerald-400">
                {Object.values(status?.checkpoints || {})[0]?.sha.slice(0, 10)}...
              </span>
            ) : (
              <span className="text-slate-400">Baseline Ready</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {Object.values(status?.checkpoints || {})[0]?.green ? 'Last Known Green' : 'Session Baseline'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">Subagents / Commands</span>
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {agentsCount} / {commandsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Model-routed assistants</div>
        </div>
      </div>

      {/* Slices & Tasks Manager */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm text-white">Slices & Task Locks</h3>
            <span className="text-xs text-slate-400 font-mono">(.spec/PROGRESS.md)</span>
          </div>
          <div className="text-xs text-slate-400">
            {parsedSlices.filter((s) => s.completed).length} of {parsedSlices.length} completed
          </div>
        </div>

        <div className="divide-y divide-slate-800/60">
          {parsedSlices.map((slice) => (
            <div
              key={slice.index}
              className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                slice.inProgress ? 'bg-indigo-950/20' : slice.completed ? 'bg-slate-950/30 opacity-75' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  {slice.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : slice.inProgress ? (
                    <span className="relative flex h-3 w-3 mt-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                  ) : (
                    <div className="w-3.5 h-3.5 rounded border border-slate-600 mt-0.5"></div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-xs text-white">{slice.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                        slice.tag.includes('CORE')
                          ? 'bg-violet-950/80 text-violet-300 border border-violet-700/40'
                          : 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/40'
                      }`}
                    >
                      {slice.tag}
                    </span>
                    {slice.inProgress && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono font-semibold">
                        [IN_PROGRESS]
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">{slice.description}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-500">Target files:</span>
                    <span className="text-slate-300 bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                      {slice.targetFiles}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                {slice.inProgress ? (
                  <>
                    <button
                      onClick={() => onSliceAction('complete', slice.index)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm transition-all"
                      title="Mark slice completed"
                    >
                      <Check className="w-3 h-3" />
                      Complete
                    </button>
                    <button
                      onClick={() => onSliceAction('uncheck', slice.index)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                      title="Pause active lock"
                    >
                      Pause
                    </button>
                  </>
                ) : slice.completed ? (
                  <button
                    onClick={() => onSliceAction('uncheck', slice.index)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                  >
                    Reopen
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onSliceAction('activate', slice.index)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center gap-1 shadow-sm transition-all"
                      title="Activate Single-Slice Lock"
                    >
                      <Lock className="w-3 h-3" />
                      Lock & Start
                    </button>
                    <button
                      onClick={() => onSliceAction('complete', slice.index)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                    >
                      Mark Done
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {parsedSlices.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No slices found in .spec/PROGRESS.md
            </div>
          )}
        </div>
      </div>

      {/* Quick Check commands card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Project Verification Rules (CLAUDE.md)
            </h4>
          </div>
          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-slate-500">Unit Tests: </span>
                <span className="text-indigo-300">node --test .harness/hooks/lib/runner-matcher.test.mjs</span>
              </div>
              <button
                onClick={() => onCopy('node --test .harness/hooks/lib/runner-matcher.test.mjs', 'cmd-test')}
                className="text-slate-500 hover:text-slate-300"
              >
                {copiedText === 'cmd-test' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-slate-500">Typecheck: </span>
                <span className="text-indigo-300">npm run typecheck --silent</span>
              </div>
              <button
                onClick={() => onCopy('npm run typecheck --silent', 'cmd-tc')}
                className="text-slate-500 hover:text-slate-300"
              >
                {copiedText === 'cmd-tc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              2-Strike Circuit Breaker Rule
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            If a test or build command fails <strong>twice in a row with the exact same error signature</strong>, the harness halts guessing.
            It runs <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded">pre-tool-guard.mjs --restore</code> to roll back to the last known green checkpoint, then presents an external audit prompt.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              Exit 127 / missing tools are setup issues, never counted as strikes.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
