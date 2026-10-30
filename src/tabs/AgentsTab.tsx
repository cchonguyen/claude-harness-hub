import React from 'react';
import { Cpu } from 'lucide-react';
import { Agent } from '../types';

interface AgentsTabProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent) => void;
}

export default function AgentsTab({
  agents,
  selectedAgent,
  onSelectAgent
}: AgentsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
          Model-Routed Subagents (.claude/agents)
        </h3>
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedAgent?.id === agent.id
                ? 'bg-indigo-950/40 border-indigo-500/50 text-white shadow-md shadow-indigo-950/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-sm capitalize flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                {agent.name}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                agent.model === 'opus' ? 'bg-amber-950/80 text-amber-300 border border-amber-800' :
                agent.model === 'sonnet' ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800' :
                'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}>
                {agent.model}
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {agent.description}
            </p>
          </div>
        ))}
      </div>

      <div className="lg:col-span-8">
        {selectedAgent ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white capitalize flex items-center gap-2 font-mono">
                  agent: {selectedAgent.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1">{selectedAgent.description}</p>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-slate-500 block">Model Target</span>
                <span className="text-sm font-semibold font-mono text-indigo-400 uppercase">
                  {selectedAgent.model}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Allowed Tools
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.tools.split(',').map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800 text-xs font-mono">
                    {t.trim()}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Subagent Directives & Prompt
              </h4>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {selectedAgent.body}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-mono">
            Select an agent from the list to view its directives
          </div>
        )}
      </div>
    </div>
  );
}
