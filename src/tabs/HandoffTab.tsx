import React from 'react';
import {
  Send,
  Play,
  FileText,
  Check,
  Copy,
  AlertTriangle,
  RefreshCw,
  Clock,
  FolderOpen
} from 'lucide-react';
import { HandoffMode, HandoffState } from '../types';

export interface LastCopiedPacketRecord {
  content: string;
  mode: HandoffMode;
  copiedAt: string;
  lineCount: number;
  includedFiles: string[];
  progressMtimeAtCopy: string | null;
}

interface HandoffTabProps {
  handoffMode: HandoffMode;
  handoffState: HandoffState | null;
  lastCopiedPacket: LastCopiedPacketRecord | null;
  currentProgressMtime: string | null;
  generatingHandoff: boolean;
  copiedText: string | null;
  onSelectMode: (mode: HandoffMode) => void;
  onGenerateHandoff: () => void;
  onCopyPacket: (packet: string) => void;
}

export default function HandoffTab({
  handoffMode,
  handoffState,
  lastCopiedPacket,
  currentProgressMtime,
  generatingHandoff,
  copiedText,
  onSelectMode,
  onGenerateHandoff,
  onCopyPacket
}: HandoffTabProps) {
  const activePacketContent =
    (handoffState?.exists && handoffState.packetContent) ||
    lastCopiedPacket?.content ||
    null;

  const activeLineCount = activePacketContent ? activePacketContent.split('\n').length : 0;
  const activeIncludedFiles =
    handoffState?.exists && handoffState.includedFiles.length > 0
      ? handoffState.includedFiles
      : lastCopiedPacket?.includedFiles || [];

  // Stale detection: either server-side packetMtime < progressMtime, or lastCopiedPacket's progressMtime < currentProgressMtime
  const copiedPacketIsStale = Boolean(
    lastCopiedPacket?.progressMtimeAtCopy &&
      currentProgressMtime &&
      new Date(currentProgressMtime).getTime() >
        new Date(lastCopiedPacket.progressMtimeAtCopy).getTime() + 500
  );

  const isStale = Boolean(handoffState?.isStale || copiedPacketIsStale);
  const staleMessage =
    handoffState?.staleReason ||
    (copiedPacketIsStale
      ? '.spec/PROGRESS.md changed after this packet was built/copied. Rebuild the packet so Gemini sees the current slice state.'
      : null);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-base text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" />
              Zero-Cost Gemini Web Clipboard Bridge (/prep-audit)
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Packages System Spec, active tasks, or git diff into{' '}
              <code className="text-indigo-300 font-mono">.spec/HANDOFF_PACKET.md</code>. Scans and
              inlines local markdown links while strictly blocking secrets (.env), git internals,
              and node_modules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {(['spec', 'diff', 'arch', 'overview'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onSelectMode(m)}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    handoffMode === m
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={onGenerateHandoff}
              disabled={generatingHandoff}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${generatingHandoff ? 'animate-spin' : ''}`} />
              {generatingHandoff ? 'Building Packet...' : 'Build Handoff Packet'}
            </button>
          </div>
        </div>

        {/* Stale Packet Warning Banner */}
        {activePacketContent && isStale && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 block">
                  Stale Handoff Packet Detected
                </span>
                <span className="text-amber-200/90">{staleMessage}</span>
              </div>
            </div>
            <button
              onClick={onGenerateHandoff}
              disabled={generatingHandoff}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingHandoff ? 'animate-spin' : ''}`} />
              Rebuild Packet
            </button>
          </div>
        )}

        {/* 1-Line Receipt display */}
        {handoffState?.receipt && (
          <div className="p-3 bg-slate-950 rounded-lg border border-indigo-500/30 text-xs font-mono text-indigo-300 flex items-center justify-between gap-2">
            <span className="truncate">{handoffState.receipt}</span>
            <span className="text-[10px] text-slate-400 uppercase font-sans shrink-0">
              1-Line Receipt
            </span>
          </div>
        )}
      </div>

      {/* Packet Pre-Copy Metadata & Preview */}
      {activePacketContent ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          {/* Pre-Copy Inspection Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-100 font-mono">
                  .spec/HANDOFF_PACKET.md
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                  {activeLineCount} lines
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                  {activeIncludedFiles.length} included file
                  {activeIncludedFiles.length === 1 ? '' : 's'}
                </span>
                {isStale ? (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700">
                    STALE (PROGRESS.md changed)
                  </span>
                ) : (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/50">
                    FRESH
                  </span>
                )}
              </div>

              <button
                onClick={() => onCopyPacket(activePacketContent)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
              >
                {copiedText === 'full-packet' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedText === 'full-packet'
                  ? 'Copied & Saved across Refresh'
                  : 'Copy Packet to Clipboard'}
              </button>
            </div>

            {/* Included Files List (shown before copying) */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mr-1">
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                Included files:
              </span>
              {activeIncludedFiles.map((file) => (
                <span
                  key={file}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300"
                >
                  {file}
                </span>
              ))}
            </div>

            {/* Last Built / Last Copied Timestamps */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
              {handoffState?.packetMtime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Built: {new Date(handoffState.packetMtime).toLocaleString()}
                </span>
              )}
              {lastCopiedPacket?.copiedAt && (
                <span className="flex items-center gap-1 text-emerald-400/90">
                  <Check className="w-3 h-3" />
                  Last copied: {new Date(lastCopiedPacket.copiedAt).toLocaleString()} (persisted
                  across page refresh)
                </span>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-950 max-h-[500px] overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
            {activePacketContent}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 text-center space-y-2">
          <p className="text-xs font-mono text-slate-400">
            No handoff packet generated yet in this session.
          </p>
          <p className="text-xs text-slate-500">
            Select a mode above and click <strong>Build Handoff Packet</strong> to inspect its line
            count and included files before copying.
          </p>
        </div>
      )}
    </div>
  );
}
