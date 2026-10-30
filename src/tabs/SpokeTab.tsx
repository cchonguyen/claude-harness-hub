import React from 'react';
import { GitBranch, Check, Copy } from 'lucide-react';

interface SpokeTabProps {
  spokeName: string;
  spokeOwner: string;
  copiedText: string | null;
  onChangeSpokeName: (name: string) => void;
  onChangeSpokeOwner: (owner: string) => void;
  onCopy: (text: string, id: string) => void;
}

export default function SpokeTab({
  spokeName,
  spokeOwner,
  copiedText,
  onChangeSpokeName,
  onChangeSpokeOwner,
  onCopy
}: SpokeTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="font-semibold text-base text-white flex items-center gap-2 mb-2">
          <GitBranch className="w-4 h-4 text-indigo-400" />
          Spoke Connection Contract & Synchronizer
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          The hub repository acts as the authoritative source of truth for the Claude harness engine.
          Spokes connect by committing <code className="text-indigo-300 font-mono">.harness/hub.json</code> and pulling engine updates via <code className="text-indigo-300 font-mono">hub-sync.mjs</code>.
        </p>

        {/* Spoke Contract 3 Rules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-xs font-mono text-indigo-400 font-bold mb-1">1. Hub Pointer</div>
            <p className="text-xs text-slate-300">
              Spokes commit <code className="text-indigo-300">.harness/hub.json</code> pointing to the repo, owner, and default branch.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-xs font-mono text-indigo-400 font-bold mb-1">2. Sibling Discovery</div>
            <p className="text-xs text-slate-300">
              Cloud containers attach repos side by side; <code className="text-indigo-300">hub-sync.mjs</code> auto-discovers sibling checkout or reads <code className="text-indigo-300">HARNESS_HUB_DIR</code>.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-xs font-mono text-indigo-400 font-bold mb-1">3. Sync Boundary</div>
            <p className="text-xs text-slate-300">
              Sync overwrites only engine files (<code className="text-indigo-300">.claude/</code>, <code className="text-indigo-300">.harness/</code>, <code className="text-indigo-300">.harness-version</code>). Project-owned <code className="text-indigo-300">.spec/</code> and <code className="text-indigo-300">CLAUDE.md</code> are never touched.
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
            <label className="block text-xs text-slate-400 font-mono mb-1">Spoke Project Name</label>
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
          <span className="text-xs text-slate-400 font-mono">1. Place in Spoke's <code className="text-indigo-300">.harness/hub.json</code>:</span>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 flex items-center justify-between">
            <code>{JSON.stringify({ repo: 'claude-harness-hub', owner: spokeOwner, branch: 'main' }, null, 2)}</code>
            <button
              onClick={() => onCopy(JSON.stringify({ repo: 'claude-harness-hub', owner: spokeOwner, branch: 'main' }, null, 2), 'hub-json')}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
            >
              {copiedText === 'hub-json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copy
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-slate-400 font-mono">2. Pull command in Spoke:</span>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-indigo-300 flex items-center justify-between">
            <code>node .harness/scripts/hub-sync.mjs pull</code>
            <button
              onClick={() => onCopy('node .harness/scripts/hub-sync.mjs pull', 'pull-cmd')}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
            >
              {copiedText === 'pull-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
