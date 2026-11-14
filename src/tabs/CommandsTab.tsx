import React from 'react';
import { Check, Copy, Terminal, ChevronRight } from 'lucide-react';
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
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
      {/* Left Column: Slash Commands List */}
      <div className="sm:col-span-5 lg:col-span-4 space-y-2 sm:max-h-[calc(100vh-10.5rem)] sm:overflow-y-auto sm:pr-1">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Slash Commands (.claude/commands)
          </h3>
          <span className="text-[11px] font-mono text-slate-500">{commands.length} total</span>
        </div>

        {commands.map((cmd) => {
          const isSelected = selectedCommand?.id === cmd.id;
          return (
            <button
              key={cmd.id}
              type="button"
              onClick={() => onSelectCommand(cmd)}
              aria-pressed={isSelected}
              className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500/60 text-white shadow-md shadow-indigo-950/30'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm font-mono text-indigo-300 truncate">
                    {cmd.name}
                  </span>
                  {cmd.disableModelInvocation && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-400 shrink-0">
                      Zero Token
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">{cmd.description}</p>
              </div>
              <ChevronRight
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Right Column: Selected Slash Command Detail & Instructions */}
      <div className="sm:col-span-7 lg:col-span-8 sm:sticky sm:top-28">
        {selectedCommand ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
                  <h2 className="text-lg sm:text-xl font-bold text-indigo-400 font-mono">
                    {selectedCommand.name}
                  </h2>
                  {selectedCommand.disableModelInvocation && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300">
                      disable-model-invocation: true
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {selectedCommand.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  onCopy(
                    selectedCommand.argumentHint
                      ? `${selectedCommand.name} ${selectedCommand.argumentHint}`
                      : selectedCommand.name,
                    'cmd-name'
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedText === 'cmd-name' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy Command
              </button>
            </div>

            {(selectedCommand.argumentHint || selectedCommand.allowedTools) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedCommand.argumentHint && (
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                      Argument Hint
                    </span>
                    <code className="text-xs text-indigo-300 font-mono break-all">
                      {selectedCommand.name} {selectedCommand.argumentHint}
                    </code>
                  </div>
                )}

                {selectedCommand.allowedTools && (
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                      Allowed Tools
                    </span>
                    <code className="text-xs font-mono text-slate-300 break-all">
                      {selectedCommand.allowedTools}
                    </code>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Command Instructions &amp; Execution Contract
                </h4>
                <button
                  type="button"
                  onClick={() => onCopy(selectedCommand.body, 'cmd-body')}
                  className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {copiedText === 'cmd-body' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  Copy Instructions
                </button>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-[55vh] overflow-y-auto">
                {selectedCommand.body}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-xs font-mono">
            Select a slash command on the left to inspect its details and instructions
          </div>
        )}
      </div>
    </div>
  );
}
