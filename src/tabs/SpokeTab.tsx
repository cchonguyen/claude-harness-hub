import React, { useState } from 'react';
import {
  GitBranch,
  Check,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  FileCheck2
} from 'lucide-react';
import { SpokeStatus } from '../types';

interface SpokeTabProps {
  spokeStatus: SpokeStatus | null;
  checkingSpoke: boolean;
  spokeName: string;
  spokeOwner: string;
  copiedText: string | null;
  onRefreshSpokeStatus: () => void;
  onChangeSpokeName: (name: string) => void;
  onChangeSpokeOwner: (owner: string) => void;
  onCopy: (text: string, id: string) => void;
}

export default function SpokeTab({
  spokeStatus,
  checkingSpoke,
  spokeName,
  spokeOwner,
  copiedText,
  onRefreshSpokeStatus,
  onChangeSpokeName,
  onChangeSpokeOwner,
  onCopy
}: SpokeTabProps) {
  const [showDryRunDetails, setShowDryRunDetails] = useState(true);

  const nonIdenticalDiffs =
    spokeStatus?.differences.filter((d) => d.status !== 'identical') || [];

  return (
    <div className="space-y-6">
      {/* Live Hub Attachment & Engine Match Status Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-base text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Hub Attachment &amp; Engine Parity Check (Dry-Run Before Sync)
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Inspects whether the hub checkout is attached and compares every engine file in{' '}
              <code className="text-indigo-300 font-mono">.claude/</code>,{' '}
              <code className="text-indigo-300 font-mono">.harness/</code>, and{' '}
              <code className="text-indigo-300 font-mono">.harness-version</code> without modifying
              your working tree.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowDryRunDetails(true);
                onRefreshSpokeStatus();
              }}
              disabled={checkingSpoke}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingSpoke ? 'animate-spin' : ''}`} />
              {checkingSpoke ? 'Running Dry-Run...' : 'Run Sync Dry-Run'}
            </button>
          </div>
        </div>

        {/* Status Pills Grid */}
        {spokeStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-1.5">
                1. Hub Attachment
              </div>
              <div className="flex items-center gap-2">
                {spokeStatus.hubAttached ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {spokeStatus.isHubRepo
                      ? 'ATTACHED (THIS IS HUB REPO)'
                      : 'ATTACHED (SIBLING CHECKOUT)'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-md">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    HUB_NOT_ATTACHED
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-2 truncate" title={spokeStatus.hubPath || ''}>
                Path: {spokeStatus.hubPath || `../${spokeStatus.hubConfig.repo} (not found)`}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-1.5">
                2. Engine Files Parity
              </div>
              <div className="flex items-center gap-2">
                {spokeStatus.engineMatches ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ENGINE FILES MATCH ({spokeStatus.filesChecked} verified)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-md">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    {spokeStatus.hubAttached
                      ? `${nonIdenticalDiffs.length} FILE(S) DIFFER`
                      : 'UNVERIFIED (NO HUB)'}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-2">
                Checked at {new Date(spokeStatus.checkedAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-1.5">
                3. Dry-Run Outcome Summary
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{spokeStatus.summary}</p>
            </div>
          </div>
        )}

        {/* Dry-Run File Table */}
        {spokeStatus && showDryRunDetails && spokeStatus.differences.length > 0 && (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-400" />
                Dry-Run File Inspection ({spokeStatus.differences.length} engine &amp; template paths)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                .spec/* &amp; CLAUDE.md are project-owned (never overwritten)
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-900 text-xs font-mono">
              {spokeStatus.differences.map((item) => (
                <div
                  key={item.path}
                  className="px-4 py-2 flex items-center justify-between gap-2 hover:bg-slate-900/40"
                >
                  <span className="text-slate-300 truncate">{item.path}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${
                      item.status === 'identical'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40'
                        : item.status === 'template-preserved'
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/40'
                        : 'bg-amber-950/70 text-amber-300 border-amber-700/50'
                    }`}
                  >
                    {item.status === 'identical'
                      ? 'IDENTICAL (NO-OP)'
                      : item.status === 'template-preserved'
                      ? 'SPOKE TEMPLATE EXISTS (PRESERVED)'
                      : item.status === 'template-missing'
                      ? 'WILL COPY MISSING TEMPLATE'
                      : item.status === 'modified'
                      ? 'WILL OVERWRITE FROM HUB'
                      : item.status === 'missing-in-spoke'
                      ? 'WILL ADD FROM HUB'
                      : 'EXTRA LOCAL FILE'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spoke Contract Rules */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="font-semibold text-base text-white flex items-center gap-2 mb-2">
          <GitBranch className="w-4 h-4 text-indigo-400" />
          Spoke Connection Contract &amp; Synchronizer
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          The hub repository acts as the authoritative source of truth for the Claude harness
          engine. Spokes connect by committing{' '}
          <code className="text-indigo-300 font-mono">.harness/hub.json</code> and pulling engine
          updates via <code className="text-indigo-300 font-mono">hub-sync.mjs</code>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-xs font-mono text-indigo-400 font-bold mb-1">1. Hub Pointer</div>
            <p className="text-xs text-slate-300">
              Spokes commit <code className="text-indigo-300">.harness/hub.json</code> pointing to
              the repo, owner, and default branch.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-xs font-mono text-indigo-400 font-bold mb-1">
              2. Sibling Discovery
            </div>
            <p className="text-xs text-slate-300">
              Cloud containers attach repos side by side;{' '}
              <code className="text-indigo-300">hub-sync.mjs</code> auto-discovers sibling checkout
              or reads <code className="text-indigo-300">HARNESS_HUB_DIR</code>.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-xs font-mono text-indigo-400 font-bold mb-1">
              3. Sync Boundary
            </div>
            <p className="text-xs text-slate-300">
              Sync overwrites only engine files (<code className="text-indigo-300">.claude/</code>,{' '}
              <code className="text-indigo-300">.harness/</code>,{' '}
              <code className="text-indigo-300">.harness-version</code>). Project-owned{' '}
              <code className="text-indigo-300">.spec/</code> and{' '}
              <code className="text-indigo-300">CLAUDE.md</code> are never touched.
            </p>
          </div>
        </div>
      </div>

      {/* Spoke Generator */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
          Connect a New Spoke Repository
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 font-mono mb-1">
              Spoke Project Name
            </label>
            <input
              type="text"
              value={spokeName}
              onChange={(e) => onChangeSpokeName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 font-mono mb-1">Hub Owner</label>
            <input
              type="text"
              value={spokeOwner}
              onChange={(e) => onChangeSpokeOwner(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-slate-400 font-mono">
            1. Place in Spoke&apos;s <code className="text-indigo-300">.harness/hub.json</code>:
          </span>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 flex items-center justify-between gap-2">
            <code className="break-all">
              {JSON.stringify(
                { repo: 'claude-harness-hub', owner: spokeOwner, branch: 'main' },
                null,
                2
              )}
            </code>
            <button
              onClick={() =>
                onCopy(
                  JSON.stringify(
                    { repo: 'claude-harness-hub', owner: spokeOwner, branch: 'main' },
                    null,
                    2
                  ),
                  'hub-json'
                )
              }
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedText === 'hub-json' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-slate-400 font-mono">2. Pull command in Spoke:</span>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-indigo-300 flex items-center justify-between gap-2">
            <code>node .harness/scripts/hub-sync.mjs pull</code>
            <button
              onClick={() => onCopy('node .harness/scripts/hub-sync.mjs pull', 'pull-cmd')}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedText === 'pull-cmd' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
