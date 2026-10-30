import React from 'react';
import { Shield, CheckCircle2 } from 'lucide-react';

export default function SecurityTab() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="font-semibold text-base text-white flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Claude Code Guardrails & Permissions (.claude/settings.json)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          Rigorous declarative permissions ensure zero secret leakage (.env files denied) and zero rogue command execution.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Deny rules */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
            <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs font-mono">
              <Shield className="w-4 h-4 text-rose-400" />
              DENY POLICIES (Strictly Enforced)
            </div>
            <ul className="space-y-1.5 text-xs font-mono text-rose-200/90">
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-rose-900/40">Read(**/.env)</li>
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-rose-900/40">Read(**/.env.*.local)</li>
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-rose-900/40">Edit(**/.env*)</li>
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-rose-900/40">Bash(* &gt; .env*)</li>
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-rose-900/40">Bash(* &gt;&gt; .env*)</li>
            </ul>
            <p className="text-[11px] text-slate-400">
              Claude Code cannot inspect or overwrite environment secret files under any circumstance.
            </p>
          </div>

          {/* Allow rules */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ALLOW POLICIES (Whitelisted)
            </div>
            <ul className="space-y-1.5 text-xs font-mono text-emerald-200/90">
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-emerald-900/40">Bash(node .harness/*)</li>
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-emerald-900/40">Bash(node "$CLAUDE_PROJECT_DIR"/.harness/*)</li>
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-emerald-900/40">Read(**/.env.example)</li>
              <li className="bg-slate-950/80 px-2 py-1 rounded border border-emerald-900/40">Read(**/.env.template)</li>
            </ul>
            <p className="text-[11px] text-slate-400">
              Deterministic harness scripts execute without prompt delays.
            </p>
          </div>
        </div>
      </div>

      {/* Lifecycle Hooks */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono mb-4">
          Active Lifecycle Hook Pipeline
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] font-mono text-indigo-400 font-bold block mb-1">1. SessionStart</span>
            <code className="text-[11px] text-slate-300 font-mono block">session-start.mjs</code>
            <p className="text-[11px] text-slate-400 mt-2">
              Takes Vibe Mode baseline snapshot and injects active slice handoff context.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] font-mono text-indigo-400 font-bold block mb-1">2. PreToolUse</span>
            <code className="text-[11px] text-slate-300 font-mono block">pre-tool-guard.mjs</code>
            <p className="text-[11px] text-slate-400 mt-2">
              Enforces single-slice lock and verifies file edits are within declared targets.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] font-mono text-indigo-400 font-bold block mb-1">3. PostToolUse</span>
            <code className="text-[11px] text-slate-300 font-mono block">post-tool-scrub.mjs</code>
            <p className="text-[11px] text-slate-400 mt-2">
              Advances green checkpoint on test/build pass and scrubs terminal noise.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] font-mono text-indigo-400 font-bold block mb-1">4. PostToolUseFailure</span>
            <code className="text-[11px] text-slate-300 font-mono block">post-tool-failure.mjs</code>
            <p className="text-[11px] text-slate-400 mt-2">
              Fingerprints error signatures and trips circuit breaker on 2 identical failures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
