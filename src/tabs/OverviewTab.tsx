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
  BookmarkCheck,
  Compass,
  ArrowRight,
  FileCode2,
  Activity
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
  onOpenSpecFile?: (path: string) => void;
}

export default function OverviewTab({
  status,
  agentsCount,
  commandsCount,
  parsedSlices,
  copiedText,
  onCopy,
  onSliceAction,
  onOpenAddSliceModal,
  onOpenSpecFile
}: OverviewTabProps) {
  const activeSlice = parsedSlices.find((s) => s.inProgress);
  const nextPendingSlice = parsedSlices.find((s) => !s.completed && !s.inProgress);

  const firstVibeCheckpoint = Object.values(status?.checkpoints || {})[0];
  const hasAnyCheckpoint = Boolean(status?.hasSliceCheckpoint || firstVibeCheckpoint?.sha);
  const checkpointSummary = status?.hasSliceCheckpoint
    ? 'Slice checkpoint active (.spec/.slice-checkpoint)'
    : firstVibeCheckpoint?.sha
    ? `Vibe checkpoint ${firstVibeCheckpoint.sha.slice(0, 8)} (${
        firstVibeCheckpoint.green ? 'Last Known Green' : 'Baseline'
      })`
    : 'No checkpoint recorded yet (advances on test/build pass)';

  const workModeLabel =
    status?.mode === 'slice'
      ? 'Slice Mode (1 active lock)'
      : status?.mode === 'conflict'
      ? `Conflict (${status.activeCount} active locks)`
      : 'Vibe Mode (0 active locks)';

  return (
    <div className="space-y-6">
      {/* "What's Next" Operator Guidance Line */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 text-amber-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
              <Compass className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono uppercase tracking-wider font-bold text-amber-300">
                  What&apos;s Next
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 font-mono text-slate-200">
                  Mode: <strong className="text-amber-300">{workModeLabel}</strong>
                </span>
                <span
                  className={`px-2 py-0.5 rounded border font-mono ${
                    hasAnyCheckpoint
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900/90 border-slate-700 text-slate-400'
                  }`}
                >
                  Checkpoint: <strong>{checkpointSummary}</strong>
                </span>
              </div>

              <div className="text-slate-200 leading-relaxed flex flex-wrap items-center gap-1.5">
                {status?.mode === 'conflict' ? (
                  <span>
                    Resolve the multi-slice lock conflict in <code className="font-mono text-amber-300">.spec/PROGRESS.md</code> so only one slice has <code className="font-mono">[IN_PROGRESS]</code>.
                  </span>
                ) : activeSlice ? (
                  <span>
                    Finish active <strong className="text-white">{activeSlice.title}</strong> ({activeSlice.description}) scoped to{' '}
                    <code className="font-mono text-amber-300 bg-slate-950/80 px-1.5 py-0.5 rounded">
                      {activeSlice.targetFiles}
                    </code>
                    , then run quick checks and mark it Complete.
                  </span>
                ) : nextPendingSlice ? (
                  <span>
                    Next pending slice in <code className="font-mono text-slate-300">.spec/PROGRESS.md</code>:{' '}
                    <strong className="text-white">{nextPendingSlice.title}</strong>{' '}
                    <span className="font-mono text-amber-300">{nextPendingSlice.tag}</span> —{' '}
                    {nextPendingSlice.description} (Targets:{' '}
                    <code className="font-mono text-slate-300 bg-slate-950/80 px-1.5 py-0.5 rounded">
                      {nextPendingSlice.targetFiles}
                    </code>
                    ). Edit directly in Vibe Mode or lock this slice below.
                  </span>
                ) : (
                  <span>
                    All slices in <code className="font-mono text-slate-300">.spec/PROGRESS.md</code> are complete. Add a new slice or edit freely in Vibe Mode.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
            {!activeSlice && nextPendingSlice && (
              <button
                onClick={() =>
                  onSliceAction(
                    'activate',
                    parsedSlices.findIndex((s) => s.index === nextPendingSlice.index)
                  )
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock {nextPendingSlice.title}
              </button>
            )}
            {activeSlice && (
              <button
                onClick={() =>
                  onSliceAction(
                    'complete',
                    parsedSlices.findIndex((s) => s.index === activeSlice.index)
                  )
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Complete {activeSlice.title}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SESSION_HANDOFF.md Status at a Glance */}
      {status?.sessionHandoff && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-xs uppercase tracking-wider font-mono text-slate-200">
                Session Handoff Status (.spec/SESSION_HANDOFF.md)
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                Last Platform: {status.sessionHandoff.lastPlatform}
              </span>
            </div>
            {onOpenSpecFile && (
              <button
                onClick={() => onOpenSpecFile('.spec/SESSION_HANDOFF.md')}
                className="text-xs font-mono text-indigo-300 hover:text-indigo-200 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                Edit Handoff File
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/90">
              <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                Immediate Next Step
              </div>
              <p className="text-slate-100 font-medium leading-relaxed">
                {status.sessionHandoff.immediateNextStep}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/90">
              <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                Verification Status
              </div>
              <p className="text-emerald-300/90 font-mono text-[11px] leading-relaxed">
                {status.sessionHandoff.verificationStatus}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/90">
              <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                Active Branch / State
              </div>
              <p className="text-slate-300 font-mono text-[11px] leading-relaxed">
                {status.sessionHandoff.activeBranchState}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top State Alert Banner */}
      <div
        className={`p-4 rounded-xl border ${
          status?.mode === 'vibe'
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            : status?.mode === 'slice'
            ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
            : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg ${
                status?.mode === 'vibe'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : status?.mode === 'slice'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {status?.mode === 'vibe' ? (
                <Unlock className="w-5 h-5" />
              ) : status?.mode === 'slice' ? (
                <Lock className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {status?.mode === 'vibe' && 'Active Engine State: VIBE MODE (No Slice Lock)'}
                {status?.mode === 'slice' &&
                  'Active Engine State: SLICE MODE (Single-Task Scope Lock)'}
                {status?.mode === 'conflict' &&
                  'Active Engine State: CONFLICT (Multiple Slices In Progress)'}
              </h3>
              <p className="text-xs mt-1 text-slate-300/80 leading-relaxed max-w-3xl">
                {status?.mode === 'vibe' &&
                  'You are in Vibe Mode. Edit requested files freely without /triage or /spec ceremony. The harness automatically snapshots session baselines and advances the "last known green" checkpoint when tests/builds pass.'}
                {status?.mode === 'slice' &&
                  `Single-slice lock is strictly enforced. The active slice is: ${
                    status.activeLines[0] || ''
                  }. Pre-tool guard blocks modifications to files outside its declared target boundaries.`}
                {status?.mode === 'conflict' &&
                  'Work lock violation! More than 1 task line in .spec/PROGRESS.md contains [IN_PROGRESS]. Tool writes are blocked until only 1 slice is active, or all are cleared.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {status?.mode !== 'vibe' && (
              <button
                onClick={() => onSliceAction('clear-all')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
              >
                Switch to Vibe Mode
              </button>
            )}
            <button
              onClick={onOpenAddSliceModal}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Slice
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">Harness Version</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            v{status?.version || '2.2.0'}
          </div>
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
            {firstVibeCheckpoint?.sha ? (
              <span className="text-emerald-400">
                {firstVibeCheckpoint.sha.slice(0, 10)}...
              </span>
            ) : status?.hasSliceCheckpoint ? (
              <span className="text-indigo-400">Slice Checkpoint Active</span>
            ) : (
              <span className="text-slate-400">No Checkpoint Yet</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {firstVibeCheckpoint?.green
              ? 'Last Known Green'
              : status?.hasSliceCheckpoint
              ? '.spec/.slice-checkpoint'
              : 'Session Baseline'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">
              Subagents / Commands
            </span>
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
            <h3 className="font-semibold text-sm text-white">Slices &amp; Task Locks</h3>
            <span className="text-xs text-slate-400 font-mono">(.spec/PROGRESS.md)</span>
          </div>
          <div className="text-xs text-slate-400">
            {parsedSlices.filter((s) => s.completed).length} of {parsedSlices.length} completed
          </div>
        </div>

        <div className="divide-y divide-slate-800/60">
          {parsedSlices.map((slice, sliceIdx) => (
            <div
              key={slice.index}
              className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                slice.inProgress
                  ? 'bg-indigo-950/20'
                  : slice.completed
                  ? 'bg-slate-950/30 opacity-75'
                  : ''
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
                    {!slice.completed &&
                      !slice.inProgress &&
                      nextPendingSlice?.index === slice.index && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                          NEXT UP
                        </span>
                      )}
                  </div>
                  <p className="text-xs text-slate-300">{slice.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-mono">
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
                      onClick={() => onSliceAction('complete', sliceIdx)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                      title="Mark slice completed"
                    >
                      <Check className="w-3 h-3" />
                      Complete
                    </button>
                    <button
                      onClick={() => onSliceAction('uncheck', sliceIdx)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      title="Pause active lock"
                    >
                      Pause
                    </button>
                  </>
                ) : slice.completed ? (
                  <button
                    onClick={() => onSliceAction('uncheck', sliceIdx)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                  >
                    Reopen
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onSliceAction('activate', sliceIdx)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                      title="Activate Single-Slice Lock"
                    >
                      <Lock className="w-3 h-3" />
                      Lock &amp; Start
                    </button>
                    <button
                      onClick={() => onSliceAction('complete', sliceIdx)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
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
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-slate-500">Unit Tests: </span>
                <span className="text-indigo-300">
                  node --test .harness/hooks/lib/runner-matcher.test.mjs
                </span>
              </div>
              <button
                onClick={() =>
                  onCopy('node --test .harness/hooks/lib/runner-matcher.test.mjs', 'cmd-test')
                }
                className="text-slate-500 hover:text-slate-300 shrink-0 cursor-pointer"
              >
                {copiedText === 'cmd-test' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-slate-500">Typecheck: </span>
                <span className="text-indigo-300">npm run typecheck --silent</span>
              </div>
              <button
                onClick={() => onCopy('npm run typecheck --silent', 'cmd-tc')}
                className="text-slate-500 hover:text-slate-300 shrink-0 cursor-pointer"
              >
                {copiedText === 'cmd-tc' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
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
            If a test or build command fails{' '}
            <strong>twice in a row with the exact same error signature</strong>, the harness halts
            guessing. It runs{' '}
            <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded">
              pre-tool-guard.mjs --restore
            </code>{' '}
            to roll back to the last known green checkpoint, then presents an external audit prompt.
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
