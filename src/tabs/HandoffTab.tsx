import React from 'react';
import { Send, Play, FileText, Check, Copy } from 'lucide-react';
import { HandoffMode } from '../types';

interface HandoffTabProps {
  handoffMode: HandoffMode;
  handoffReceipt: string | null;
  handoffPacket: string | null;
  generatingHandoff: boolean;
  copiedText: string | null;
  onSelectMode: (mode: HandoffMode) => void;
  onGenerateHandoff: () => void;
  onCopy: (text: string, id: string) => void;
}

export default function HandoffTab({
  handoffMode,
  handoffReceipt,
  handoffPacket,
  generatingHandoff,
  copiedText,
  onSelectMode,
  onGenerateHandoff,
  onCopy
}: HandoffTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-base text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" />
              Zero-Cost Gemini Web Clipboard Bridge (/prep-audit)
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Packages System Spec, active tasks, or git diff into <code className="text-indigo-300 font-mono">.spec/HANDOFF_PACKET.md</code>.
              Scans and inlines local markdown links while strictly blocking secrets (.env), git internals, and node_modules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {(['spec', 'diff', 'arch', 'overview'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onSelectMode(m)}
                  className={`px-3 py-1 rounded-md transition-all ${
                    handoffMode === m ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={onGenerateHandoff}
              disabled={generatingHandoff}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Play className={`w-3.5 h-3.5 ${generatingHandoff ? 'animate-spin' : ''}`} />
              {generatingHandoff ? 'Generating Packet...' : 'Generate Packet'}
            </button>
          </div>
        </div>

        {/* 1-Line Receipt display */}
        {handoffReceipt && (
          <div className="p-3 bg-slate-950 rounded-lg border border-indigo-500/30 text-xs font-mono text-indigo-300 flex items-center justify-between">
            <span>{handoffReceipt}</span>
            <span className="text-[10px] text-slate-400 uppercase font-sans">1-Line Receipt</span>
          </div>
        )}
      </div>

      {/* Packet Preview & Copy */}
      {handoffPacket && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200 font-mono">
                Generated Packet: .spec/HANDOFF_PACKET.md ({handoffPacket.split('\n').length} lines)
              </span>
            </div>

            <button
              onClick={() => onCopy(handoffPacket, 'full-packet')}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              {copiedText === 'full-packet' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copy to Clipboard for Gemini
            </button>
          </div>

          <div className="p-4 bg-slate-950 max-h-[500px] overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
            {handoffPacket}
          </div>
        </div>
      )}
    </div>
  );
}
