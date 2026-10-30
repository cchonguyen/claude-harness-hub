import React from 'react';
import { Check, Copy } from 'lucide-react';
import { CommandDoc } from '../types';

interface CommandsTabProps {
  commands: CommandDoc[];
  selectedCommand: CommandDoc | null;
  copiedText: string | null;
  onSelectCommand: (cmd: CommandDoc) => void;
  onCopy: (text: string, id: string) => void;
}

export default function CommandsTab({
  commands,
  selectedCommand,
  copiedText,
  onSelectCommand,
  onCopy
}: CommandsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
          Harness Slash Commands (.claude/commands)
        </h3>
        {commands.map((cmd) => (
          <div
            key={cmd.id}
            onClick={() => onSelectCommand(cmd)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              selectedCommand?.id === cmd.id
                ? 'bg-indigo-950/40 border-indigo-500/50 text-white shadow-md shadow-indigo-950/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm font-mono text-indigo-300">{cmd.name}</span>
              {cmd.disableModelInvocation && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-700 text-slate-400">
                  Zero Token
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">{cmd.description}</p>
          </div>
        ))}
      </div>

      <div className="lg:col-span-8">
        {selectedCommand ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-indigo-400 font-mono">{selectedCommand.name}</h2>
                <p className="text-xs text-slate-300 mt-1">{selectedCommand.description}</p>
              </div>

              <button
                onClick={() => onCopy(selectedCommand.name, 'cmd-name')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5"
              >
                {copiedText === 'cmd-name' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Command
              </button>
            </div>

            {selectedCommand.argumentHint && (
              <div>
                <span className="text-[11px] font-mono text-slate-500 block mb-1">Argument Hint</span>
                <code className="text-xs text-indigo-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono">
                  {selectedCommand.argumentHint}
                </code>
              </div>
            )}

            {selectedCommand.allowedTools && (
              <div>
                <span className="text-[11px] font-mono text-slate-500 block mb-1">Allowed Tools</span>
                <div className="text-xs font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 inline-block">
                  {selectedCommand.allowedTools}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Command Instructions & Execution Contract
              </h4>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {selectedCommand.body}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-mono">
            Select a command from the list
          </div>
        )}
      </div>
    </div>
  );
}
