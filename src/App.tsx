import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Terminal,
  FileCode,
  Layers,
  Send,
  GitBranch,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Plus,
  Lock,
  Unlock,
  Radio,
  FileText,
  Search,
  ExternalLink,
  Flame,
  Zap,
  Cpu,
  BookmarkCheck,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { HarnessStatus, SpecFile, Agent, CommandDoc, RunnerClassification } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'runner' | 'agents' | 'commands' | 'handoff' | 'specs' | 'spoke' | 'security'>('overview');
  const [status, setStatus] = useState<HarnessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Runner state
  const [testCmdInput, setTestCmdInput] = useState('vitest run --reporter=dot');
  const [classification, setClassification] = useState<RunnerClassification | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Agents & Commands state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [commands, setCommands] = useState<CommandDoc[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<CommandDoc | null>(null);

  // Spec files state
  const [specFiles, setSpecFiles] = useState<SpecFile[]>([]);
  const [selectedSpecPath, setSelectedSpecPath] = useState<string>('.spec/PROGRESS.md');
  const [specContent, setSpecContent] = useState<string>('');
  const [savingSpec, setSavingSpec] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handoff state
  const [handoffMode, setHandoffMode] = useState<'spec' | 'diff' | 'arch' | 'overview'>('spec');
  const [handoffReceipt, setHandoffReceipt] = useState<string | null>(null);
  const [handoffPacket, setHandoffPacket] = useState<string | null>(null);
  const [generatingHandoff, setGeneratingHandoff] = useState(false);

  // New Slice form state
  const [showAddSliceModal, setShowAddSliceModal] = useState(false);
  const [newSliceNum, setNewSliceNum] = useState('3');
  const [newSliceDesc, setNewSliceDesc] = useState('');
  const [newSliceIsCore, setNewSliceIsCore] = useState(true);
  const [newSliceTargets, setNewSliceTargets] = useState('');

  // Spoke config generator state
  const [spokeName, setSpokeName] = useState('my-spoke-app');
  const [spokeOwner, setSpokeOwner] = useState('cchonguyen');

  // Load status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  };

  // Load all initial data
  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStatus(),
      fetchSpecFiles(),
      fetchAgents(),
      fetchCommands()
    ]);
    setLoading(false);
  };

  const fetchSpecFiles = async () => {
    try {
      const res = await fetch('/api/spec-files');
      if (res.ok) {
        const data = await res.json();
        setSpecFiles(data.files || []);
        const active = data.files.find((f: SpecFile) => f.path === selectedSpecPath);
        if (active) setSpecContent(active.content);
      }
    } catch (e) {
      console.error('Failed to fetch spec files:', e);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        if (data.agents?.length && !selectedAgent) setSelectedAgent(data.agents[0]);
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  };

  const fetchCommands = async () => {
    try {
      const res = await fetch('/api/commands');
      if (res.ok) {
        const data = await res.json();
        setCommands(data.commands || []);
        if (data.commands?.length && !selectedCommand) setSelectedCommand(data.commands[0]);
      }
    } catch (e) {
      console.error('Failed to fetch commands:', e);
    }
  };

  useEffect(() => {
    loadInitialData();
    classifyCommand('vitest run --reporter=dot');
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStatus(), fetchSpecFiles()]);
    setRefreshing(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Spec file selection
  const handleSelectSpec = (filePath: string) => {
    setSelectedSpecPath(filePath);
    const file = specFiles.find((f) => f.path === filePath);
    if (file) setSpecContent(file.content);
    setSaveSuccess(false);
  };

  // Save spec file
  const handleSaveSpec = async () => {
    setSavingSpec(true);
    try {
      const res = await fetch('/api/spec-file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedSpecPath, content: specContent })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        await Promise.all([fetchSpecFiles(), fetchStatus()]);
      }
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSavingSpec(false);
    }
  };

  // Progress slice actions
  const handleSliceAction = async (action: 'activate' | 'complete' | 'uncheck' | 'clear-all', sliceIndex?: number) => {
    try {
      const res = await fetch('/api/progress/slice-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sliceIndex })
      });
      if (res.ok) {
        await Promise.all([fetchStatus(), fetchSpecFiles()]);
      }
    } catch (e) {
      console.error('Slice action failed:', e);
    }
  };

  // Add slice action
  const handleAddSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSliceDesc || !newSliceTargets) return;
    try {
      const res = await fetch('/api/progress/slice-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          newSlice: {
            number: newSliceNum,
            description: newSliceDesc,
            isCore: newSliceIsCore,
            targetFiles: newSliceTargets
          }
        })
      });
      if (res.ok) {
        setShowAddSliceModal(false);
        setNewSliceDesc('');
        setNewSliceTargets('');
        setNewSliceNum((parseInt(newSliceNum) + 1).toString());
        await Promise.all([fetchStatus(), fetchSpecFiles()]);
      }
    } catch (e) {
      console.error('Failed to add slice:', e);
    }
  };

  // Runner classification
  const classifyCommand = async (cmd: string) => {
    setClassifying(true);
    try {
      const res = await fetch('/api/runner/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      if (res.ok) {
        const data = await res.json();
        setClassification(data);
      }
    } catch (e) {
      console.error('Classification error:', e);
    } finally {
      setClassifying(false);
    }
  };

  // Run tests
  const handleRunTests = async () => {
    setRunningTests(true);
    setTestOutput(null);
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      const data = await res.json();
      setTestOutput(data.stdout || data.stderr || 'No output recorded');
    } catch (e: any) {
      setTestOutput(`Execution error: ${e.message}`);
    } finally {
      setRunningTests(false);
    }
  };

  // Generate handoff packet
  const handleGenerateHandoff = async () => {
    setGeneratingHandoff(true);
    try {
      const res = await fetch('/api/bundle-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: handoffMode })
      });
      if (res.ok) {
        const data = await res.json();
        setHandoffReceipt(data.receipt);
        setHandoffPacket(data.packetContent);
      }
    } catch (e: any) {
      setHandoffReceipt(`Failed to generate packet: ${e.message}`);
    } finally {
      setGeneratingHandoff(false);
    }
  };

  // Parse slices from PROGRESS.md for the UI cards
  const progressDoc = specFiles.find((f) => f.path === '.spec/PROGRESS.md')?.content || '';
  const parsedSlices = React.useMemo(() => {
    const lines = progressDoc.split('\n');
    const slices: Array<{
      index: number;
      completed: boolean;
      inProgress: boolean;
      title: string;
      tag: string;
      description: string;
      targetFiles: string;
      raw: string;
    }> = [];

    let sliceCount = 0;
    for (const line of lines) {
      const m = line.match(/^(\s*-\s*\[)([ xX])(\]\s*\*\*Slice\s+([^:*]+)\*\*)\s*`?(\[.*?\])?`?:\s*([^\n—]+)(?:—\s*Target files:\s*(.+))?/);
      if (m) {
        const completed = m[2].toLowerCase() === 'x';
        const inProgress = line.includes('[IN_PROGRESS]');
        const title = `Slice ${m[4].trim()}`;
        const tag = m[5] ? m[5].trim() : '[CORE / DATA]';
        const description = m[6].replace(/\[IN_PROGRESS\]/, '').trim();
        const targetFiles = m[7] ? m[7].trim() : 'Unspecified';

        slices.push({
          index: sliceCount,
          completed,
          inProgress,
          title,
          tag,
          description,
          targetFiles,
          raw: line
        });
        sliceCount++;
      }
    }
    return slices;
  }, [progressDoc]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base tracking-tight text-white flex items-center gap-2">
                Claude Harness Hub
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                  v{status?.version || '2.2.0'}
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {status?.hubConfig?.owner || 'cchonguyen'}/{status?.hubConfig?.repo || 'claude-harness-hub'} :{' '}
              <span className="text-slate-300">{status?.hubConfig?.branch || 'main'}</span>
            </p>
          </div>
        </div>

        {/* Global Work Mode Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
            {status?.mode === 'vibe' && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Vibe Mode: Edit Freely
              </span>
            )}
            {status?.mode === 'slice' && (
              <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                Slice Mode: Task Lock Active
              </span>
            )}
            {status?.mode === 'conflict' && (
              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Conflict: {status.activeCount} Slices Active
              </span>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Sync</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-slate-800 bg-slate-900/50 px-4 lg:px-8 py-1.5 overflow-x-auto flex gap-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'overview'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          Dashboard & Work Mode
        </button>

        <button
          onClick={() => setActiveTab('runner')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'runner'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Runner Matcher & Tests
        </button>

        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'agents'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Subagents Matrix
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {agents.length || 4}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('commands')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'commands'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Zap className="w-4 h-4" />
          Slash Commands
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {commands.length || 10}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('handoff')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'handoff'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Send className="w-4 h-4" />
          Handoff Packet Studio
        </button>

        <button
          onClick={() => setActiveTab('specs')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'specs'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <FileCode className="w-4 h-4" />
          Spec & Contracts Editor
        </button>

        <button
          onClick={() => setActiveTab('spoke')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'spoke'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          Spoke Sync Hub
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === 'security'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Shield className="w-4 h-4" />
          Guardrails & Hooks
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
        {/* ===================== TAB 1: OVERVIEW & WORK MODE ===================== */}
        {activeTab === 'overview' && (
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
                      onClick={() => handleSliceAction('clear-all')}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                    >
                      Switch to Vibe Mode
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddSliceModal(true)}
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
                  {agents.length} / {commands.length}
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
                            onClick={() => handleSliceAction('complete', slice.index)}
                            className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm transition-all"
                            title="Mark slice completed"
                          >
                            <Check className="w-3 h-3" />
                            Complete
                          </button>
                          <button
                            onClick={() => handleSliceAction('uncheck', slice.index)}
                            className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                            title="Pause active lock"
                          >
                            Pause
                          </button>
                        </>
                      ) : slice.completed ? (
                        <button
                          onClick={() => handleSliceAction('uncheck', slice.index)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                        >
                          Reopen
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSliceAction('activate', slice.index)}
                            className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center gap-1 shadow-sm transition-all"
                            title="Activate Single-Slice Lock"
                          >
                            <Lock className="w-3 h-3" />
                            Lock & Start
                          </button>
                          <button
                            onClick={() => handleSliceAction('complete', slice.index)}
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
                      onClick={() => handleCopy('node --test .harness/hooks/lib/runner-matcher.test.mjs', 'cmd-test')}
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
                      onClick={() => handleCopy('npm run typecheck --silent', 'cmd-tc')}
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
        )}

        {/* ===================== TAB 2: RUNNER MATCHER & TESTS ===================== */}
        {activeTab === 'runner' && (
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    Runner Matcher Classifier Probe
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Simulate how <code className="text-indigo-300 font-mono">runner-matcher.mjs</code> categorizes shell commands. Test whether a command counts as a test/build runner and whether it can advance the Vibe Mode checkpoint.
                  </p>
                </div>

                <button
                  onClick={handleRunTests}
                  disabled={runningTests}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-sm transition-all"
                >
                  <Play className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
                  {runningTests ? 'Executing Harness Tests...' : 'Run Harness Unit Tests'}
                </button>
              </div>

              {/* Command input */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={testCmdInput}
                      onChange={(e) => {
                        setTestCmdInput(e.target.value);
                        classifyCommand(e.target.value);
                      }}
                      placeholder="Type any command, e.g. npm test, vitest run, ruff check --quiet, npm install..."
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Pre-populated sample pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-slate-500 font-mono">Presets:</span>
                  {[
                    'npx vitest run --reporter=dot',
                    'pytest -q --tb=short',
                    'npm test',
                    'node --test .harness/hooks/lib/runner-matcher.test.mjs',
                    'pnpm run build',
                    'ruff check --quiet',
                    'npx eslint .',
                    'npm run typecheck --silent',
                    'npm install',
                    'cat test.txt'
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setTestCmdInput(preset);
                        classifyCommand(preset);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Classification Result Card */}
              {classification && (
                <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Runner Match:</span>
                      {classification.isTestOrBuild ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> MATCHED
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-700 font-medium">
                          NOT A RUNNER
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Advances Green Checkpoint:</span>
                      {classification.advancesGreen ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 font-medium flex items-center gap-1">
                          <BookmarkCheck className="w-3 h-3" /> YES (ADVANCES)
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 font-medium">
                          NO (NEVER ADVANCES)
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-sans border-t border-slate-800/80 pt-2">
                    <span className="text-slate-500 font-mono mr-1">Rule:</span>
                    {classification.reason}
                  </p>
                </div>
              )}
            </div>

            {/* Test Run Output */}
            {testOutput && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-200 font-mono">
                      Test Runner Result: node --test .harness/hooks/lib/runner-matcher.test.mjs
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(testOutput, 'test-res')}
                    className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                  >
                    {copiedText === 'test-res' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
                  {testOutput}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: SUBAGENTS MATRIX ===================== */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Model-Routed Subagents (.claude/agents)
              </h3>
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
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
        )}

        {/* ===================== TAB 4: SLASH COMMANDS ===================== */}
        {activeTab === 'commands' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Harness Slash Commands (.claude/commands)
              </h3>
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  onClick={() => setSelectedCommand(cmd)}
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
                      onClick={() => handleCopy(selectedCommand.name, 'cmd-name')}
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
        )}

        {/* ===================== TAB 5: HANDOFF PACKET STUDIO ===================== */}
        {activeTab === 'handoff' && (
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
                        onClick={() => setHandoffMode(m)}
                        className={`px-3 py-1 rounded-md transition-all ${
                          handoffMode === m ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleGenerateHandoff}
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
                    onClick={() => handleCopy(handoffPacket, 'full-packet')}
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
        )}

        {/* ===================== TAB 6: SPEC & CONTRACTS EDITOR ===================== */}
        {activeTab === 'specs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                System Contracts & Specs
              </h3>
              {specFiles.map((file) => (
                <div
                  key={file.path}
                  onClick={() => handleSelectSpec(file.path)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedSpecPath === file.path
                      ? 'bg-indigo-950/40 border-indigo-500/50 text-white shadow-md shadow-indigo-950/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs font-mono">{file.path}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{file.lineCount} lines</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {file.exists ? `Size: ${(file.size / 1024).toFixed(1)} KB` : 'Not created'}
                  </p>
                </div>
              ))}
            </div>

            <div className="lg:col-span-8 space-y-3">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-white font-mono">{selectedSpecPath}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {saveSuccess && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                    <button
                      onClick={handleSaveSpec}
                      disabled={savingSpec}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      {savingSpec ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BookmarkCheck className="w-3 h-3" />}
                      Save Changes
                    </button>
                  </div>
                </div>

                <textarea
                  value={specContent}
                  onChange={(e) => setSpecContent(e.target.value)}
                  className="w-full h-[520px] bg-slate-950 p-4 text-xs font-mono text-slate-200 focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 7: SPOKE SYNC HUB ===================== */}
        {activeTab === 'spoke' && (
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
                    onChange={(e) => setSpokeName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-mono mb-1">Hub Owner</label>
                  <input
                    type="text"
                    value={spokeOwner}
                    onChange={(e) => setSpokeOwner(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-mono">1. Place in Spoke's <code className="text-indigo-300">.harness/hub.json</code>:</span>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 flex items-center justify-between">
                  <code>{JSON.stringify({ repo: 'claude-harness-hub', owner: spokeOwner, branch: 'main' }, null, 2)}</code>
                  <button
                    onClick={() => handleCopy(JSON.stringify({ repo: 'claude-harness-hub', owner: spokeOwner, branch: 'main' }, null, 2), 'hub-json')}
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
                    onClick={() => handleCopy('node .harness/scripts/hub-sync.mjs pull', 'pull-cmd')}
                    className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                  >
                    {copiedText === 'pull-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 8: GUARDRAILS & SECURITY ===================== */}
        {activeTab === 'security' && (
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
        )}
      </main>

      {/* Add Slice Modal */}
      {showAddSliceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Add New Atomic Slice (.spec/PROGRESS.md)
              </h3>
              <button
                onClick={() => setShowAddSliceModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSlice} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs text-slate-400 font-mono mb-1">Slice Number</label>
                  <input
                    type="text"
                    value={newSliceNum}
                    onChange={(e) => setNewSliceNum(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 font-mono mb-1">Risk Tag</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewSliceIsCore(true)}
                      className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-all ${
                        newSliceIsCore
                          ? 'bg-violet-950/80 border-violet-500 text-violet-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      [CORE / DATA]
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSliceIsCore(false)}
                      className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-all ${
                        !newSliceIsCore
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      [UI / VISUAL]
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1">Slice Description</label>
                <input
                  type="text"
                  placeholder="e.g. Implement Spoke Hub Sync Handshake"
                  value={newSliceDesc}
                  onChange={(e) => setNewSliceDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1">Declared Target Files (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. .harness/scripts/hub-sync.mjs, .spec/"
                  value={newSliceTargets}
                  onChange={(e) => setNewSliceTargets(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSliceModal(false)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Append to PROGRESS.md
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
