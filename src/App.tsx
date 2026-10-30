import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Terminal,
  FileCode2,
  Cpu,
  Command,
  Package,
  GitBranch,
  RefreshCw,
  Activity,
  XCircle,
  Lock
} from 'lucide-react';
import {
  HarnessStatus,
  SpecFile,
  Agent,
  CommandDoc,
  RunnerClassification,
  TabId,
  HandoffMode,
  SliceActionType,
  NewSliceInput,
  ParsedSlice
} from './types';
import {
  getStatus,
  getSpecFiles,
  saveSpecFile,
  performSliceAction,
  addSlice,
  getAgents,
  getCommands,
  classifyRunnerCommand,
  runHarnessTests,
  generateBundleHandoff
} from './api';
import OverviewTab from './tabs/OverviewTab';
import RunnerTab from './tabs/RunnerTab';
import AgentsTab from './tabs/AgentsTab';
import CommandsTab from './tabs/CommandsTab';
import HandoffTab from './tabs/HandoffTab';
import SpecsTab from './tabs/SpecsTab';
import SpokeTab from './tabs/SpokeTab';
import SecurityTab from './tabs/SecurityTab';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [status, setStatus] = useState<HarnessStatus | null>(null);
  const [specFiles, setSpecFiles] = useState<SpecFile[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [commands, setCommands] = useState<CommandDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Spec editor state
  const [selectedFile, setSelectedFile] = useState<string>('.spec/PROGRESS.md');
  const [editorContent, setEditorContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Runner sandbox state
  const [runnerInput, setRunnerInput] = useState('npm test');
  const [runnerResult, setRunnerResult] = useState<RunnerClassification | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Handoff state
  const [handoffMode, setHandoffMode] = useState<HandoffMode>('spec');
  const [handoffReceipt, setHandoffReceipt] = useState<string | null>(null);
  const [handoffPacket, setHandoffPacket] = useState<string | null>(null);
  const [generatingHandoff, setGeneratingHandoff] = useState(false);

  // Agents & Commands selection
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandDoc | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Spoke configurator state
  const [spokeName, setSpokeName] = useState('claude-harness-hub');
  const [spokeOwner, setSpokeOwner] = useState('cchonguyen');

  // New slice modal state
  const [showNewSliceModal, setShowNewSliceModal] = useState(false);
  const [newSliceForm, setNewSliceForm] = useState<NewSliceInput>({
    number: '3',
    description: '',
    isCore: true,
    targetFiles: 'src/'
  });

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getStatus();
      if (data) {
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  }, []);

  const fetchSpecFiles = useCallback(async () => {
    try {
      const files = await getSpecFiles();
      setSpecFiles(files);
      const current = files.find((f: SpecFile) => f.path === selectedFile);
      if (current) {
        setEditorContent(current.content);
      }
    } catch (e) {
      console.error('Failed to fetch spec files', e);
    }
  }, [selectedFile]);

  const fetchAgentsAndCommands = useCallback(async () => {
    try {
      const [loadedAgents, loadedCommands] = await Promise.all([
        getAgents(),
        getCommands()
      ]);
      setAgents(loadedAgents);
      if (loadedAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(loadedAgents[0]);
      }
      setCommands(loadedCommands);
      if (loadedCommands.length > 0 && !selectedCommand) {
        setSelectedCommand(loadedCommands[0]);
      }
    } catch (e) {
      console.error('Failed to fetch agents/commands', e);
    }
  }, [selectedAgent, selectedCommand]);

  const classifyCommand = useCallback(async (cmd: string) => {
    try {
      const data = await classifyRunnerCommand(cmd);
      if (data) {
        setRunnerResult(data);
      }
    } catch (e) {
      console.error('Failed to classify command', e);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchSpecFiles(), fetchAgentsAndCommands()]).finally(() => {
      setLoading(false);
    });
  }, [fetchStatus, fetchSpecFiles, fetchAgentsAndCommands]);

  useEffect(() => {
    classifyCommand(runnerInput);
  }, [runnerInput, classifyCommand]);

  const handleSelectSpecFile = (path: string) => {
    setSelectedFile(path);
    const found = specFiles.find((f) => f.path === path);
    if (found) {
      setEditorContent(found.content);
    }
    setSaveMessage(null);
  };

  const handleSaveSpecFile = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const ok = await saveSpecFile(selectedFile, editorContent);
      if (ok) {
        setSaveMessage('Saved & updated harness state');
        await Promise.all([fetchStatus(), fetchSpecFiles()]);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch {
      setSaveMessage('Error saving file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSliceAction = async (action: SliceActionType, sliceIndex?: number) => {
    try {
      const ok = await performSliceAction(action, sliceIndex);
      if (ok) {
        await Promise.all([fetchStatus(), fetchSpecFiles()]);
      }
    } catch (e) {
      console.error('Failed slice action', e);
    }
  };

  const handleAddSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSliceForm.description.trim()) return;
    try {
      const ok = await addSlice(newSliceForm);
      if (ok) {
        setShowNewSliceModal(false);
        setNewSliceForm({
          number: String(Number(newSliceForm.number) + 1 || 4),
          description: '',
          isCore: true,
          targetFiles: 'src/'
        });
        await Promise.all([fetchStatus(), fetchSpecFiles()]);
      }
    } catch (err) {
      console.error('Failed to add slice', err);
    }
  };

  const handleRunTests = async () => {
    setRunningTests(true);
    setTestOutput(null);
    try {
      const data = await runHarnessTests();
      setTestOutput((data.stdout || '') + (data.stderr ? `\n${data.stderr}` : ''));
    } catch (e) {
      setTestOutput(`Error running tests: ${String(e)}`);
    } finally {
      setRunningTests(false);
    }
  };

  const handleGenerateHandoff = async (mode: HandoffMode) => {
    setHandoffMode(mode);
    setGeneratingHandoff(true);
    try {
      const data = await generateBundleHandoff(mode);
      if (data) {
        setHandoffReceipt(data.receipt);
        setHandoffPacket(data.packetContent);
        await fetchSpecFiles();
      }
    } catch (e) {
      console.error('Failed to generate handoff', e);
    } finally {
      setGeneratingHandoff(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Parse slices from .spec/PROGRESS.md
  const progressFile = specFiles.find((f) => f.path === '.spec/PROGRESS.md');
  const parsedSlices: ParsedSlice[] = React.useMemo(() => {
    if (!progressFile) return [];
    const lines = progressFile.content.split('\n');
    const slices: ParsedSlice[] = [];
    lines.forEach((line, idx) => {
      if (/^\s*-\s*\[[xX ]\]\s*\*\*Slice/i.test(line)) {
        const completed = /^\s*-\s*\[[xX]\]/.test(line);
        const inProgress = /\[IN_PROGRESS\]/.test(line);
        const titleMatch = line.match(/\*\*(Slice[^*]+)\*\*/);
        const tagMatch = line.match(/`(\[(?:CORE \/ DATA|UI \/ VISUAL)\])`/);
        const targetMatch = line.match(/Target files:\s*(.+)$/);
        let desc = line
          .replace(/^\s*-\s*\[[xX ]\]\s*/, '')
          .replace(/\[IN_PROGRESS\]\s*/, '')
          .replace(/\*\*Slice[^*]+\*\*\s*/, '')
          .replace(/`\[(?:CORE \/ DATA|UI \/ VISUAL)\]`\s*/, '')
          .replace(/\s*—\s*Target files:\s*.+$/, '')
          .replace(/^:\s*/, '')
          .trim();

        slices.push({
          index: idx,
          completed,
          inProgress,
          title: titleMatch ? titleMatch[1] : `Slice ${slices.length + 1}`,
          tag: tagMatch ? tagMatch[1] : '[CORE / DATA]',
          description: desc,
          targetFiles: targetMatch ? targetMatch[1].trim() : 'unspecified',
          raw: line
        });
      }
    });
    return slices;
  }, [progressFile]);

  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'overview',
      label: 'State Machine & Slices',
      icon: <Activity className="w-4 h-4" />,
      badge: status?.mode.toUpperCase()
    },
    {
      id: 'runner',
      label: 'Runner Matcher Lab',
      icon: <Terminal className="w-4 h-4" />,
      badge: '15 Tests'
    },
    {
      id: 'agents',
      label: 'Subagents',
      icon: <Cpu className="w-4 h-4" />,
      badge: String(agents.length || 4)
    },
    {
      id: 'commands',
      label: 'Slash Commands',
      icon: <Command className="w-4 h-4" />,
      badge: String(commands.length || 10)
    },
    {
      id: 'handoff',
      label: 'Handoff Bundler',
      icon: <Package className="w-4 h-4" />
    },
    {
      id: 'specs',
      label: '.spec & Rules Studio',
      icon: <FileCode2 className="w-4 h-4" />
    },
    {
      id: 'spoke',
      label: 'Spoke Sync & Bootstrap',
      icon: <GitBranch className="w-4 h-4" />
    },
    {
      id: 'security',
      label: 'Security & Audit',
      icon: <Lock className="w-4 h-4" />,
      badge: 'B+'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0D12] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0D1117]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-semibold tracking-tight text-slate-100 text-base">
                  claude-harness-hub
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  v{status?.version || '2.2.0'}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                  <GitBranch className="w-3 h-3 text-slate-500" />
                  {status?.hubConfig.owner}/{status?.hubConfig.repo}@{status?.hubConfig.branch}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Hybrid Control Plane — Vibe Mode Fast Path &amp; Slice Mode Verification Gate
              </p>
            </div>
          </div>

          {/* Live Mode Status Pill */}
          <div className="flex items-center gap-3">
            {status && (
              <div
                className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                  status.mode === 'vibe'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : status.mode === 'slice'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    status.mode === 'vibe'
                      ? 'bg-emerald-400 animate-pulse'
                      : status.mode === 'slice'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-400 animate-ping'
                  }`}
                />
                <span className="font-semibold uppercase tracking-wider">
                  {status.mode === 'vibe'
                    ? 'VIBE MODE (0 ACTIVE)'
                    : status.mode === 'slice'
                    ? 'SLICE MODE (1 ACTIVE)'
                    : `CONFLICT (${status.activeCount} ACTIVE)`}
                </span>
              </div>
            )}

            <button
              onClick={() => {
                fetchStatus();
                fetchSpecFiles();
              }}
              title="Refresh live repository state"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-800/50">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            status={status}
            agentsCount={agents.length || 4}
            commandsCount={commands.length || 10}
            parsedSlices={parsedSlices}
            copiedText={copiedId}
            onCopy={copyToClipboard}
            onSliceAction={handleSliceAction}
            onOpenAddSliceModal={() => setShowNewSliceModal(true)}
          />
        )}

        {activeTab === 'runner' && (
          <RunnerTab
            testCmdInput={runnerInput}
            classification={runnerResult}
            testOutput={testOutput}
            runningTests={runningTests}
            copiedText={copiedId}
            onChangeCmdInput={setRunnerInput}
            onRunTests={handleRunTests}
            onCopy={copyToClipboard}
          />
        )}

        {activeTab === 'agents' && (
          <AgentsTab
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
          />
        )}

        {activeTab === 'commands' && (
          <CommandsTab
            commands={commands}
            selectedCommand={selectedCommand}
            copiedText={copiedId}
            onSelectCommand={setSelectedCommand}
            onCopy={copyToClipboard}
          />
        )}

        {activeTab === 'handoff' && (
          <HandoffTab
            handoffMode={handoffMode}
            handoffReceipt={handoffReceipt}
            handoffPacket={handoffPacket}
            generatingHandoff={generatingHandoff}
            copiedText={copiedId}
            onSelectMode={setHandoffMode}
            onGenerateHandoff={() => handleGenerateHandoff(handoffMode)}
            onCopy={copyToClipboard}
          />
        )}

        {activeTab === 'specs' && (
          <SpecsTab
            specFiles={specFiles}
            selectedSpecPath={selectedFile}
            specContent={editorContent}
            savingSpec={isSaving}
            saveSuccess={Boolean(saveMessage)}
            onSelectSpec={handleSelectSpecFile}
            onChangeSpecContent={setEditorContent}
            onSaveSpec={handleSaveSpecFile}
          />
        )}

        {activeTab === 'spoke' && (
          <SpokeTab
            spokeName={spokeName}
            spokeOwner={spokeOwner}
            copiedText={copiedId}
            onChangeSpokeName={setSpokeName}
            onChangeSpokeOwner={setSpokeOwner}
            onCopy={copyToClipboard}
          />
        )}

        {activeTab === 'security' && <SecurityTab />}
      </main>

      {/* Add Slice Modal */}
      {showNewSliceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1117] border border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100">
                Add New Vertical Slice to .spec/PROGRESS.md
              </h3>
              <button
                onClick={() => setShowNewSliceModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddSlice} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Slice Number</label>
                  <input
                    type="text"
                    value={newSliceForm.number}
                    onChange={(e) => setNewSliceForm({ ...newSliceForm, number: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0A0D12] border border-slate-800 text-xs font-mono text-slate-200"
                    placeholder="3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Risk Classification</label>
                  <select
                    value={newSliceForm.isCore ? 'core' : 'ui'}
                    onChange={(e) =>
                      setNewSliceForm({ ...newSliceForm, isCore: e.target.value === 'core' })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0A0D12] border border-slate-800 text-xs font-mono text-slate-200"
                  >
                    <option value="core">[CORE / DATA]</option>
                    <option value="ui">[UI / VISUAL]</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Slice Description</label>
                <input
                  type="text"
                  value={newSliceForm.description}
                  onChange={(e) =>
                    setNewSliceForm({ ...newSliceForm, description: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0A0D12] border border-slate-800 text-xs text-slate-200"
                  placeholder="e.g. Add webhook signature validator"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Files</label>
                <input
                  type="text"
                  value={newSliceForm.targetFiles}
                  onChange={(e) =>
                    setNewSliceForm({ ...newSliceForm, targetFiles: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0A0D12] border border-slate-800 text-xs font-mono text-slate-200"
                  placeholder="e.g. src/webhook.ts, tests/webhook.test.ts"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewSliceModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium cursor-pointer"
                >
                  Append Slice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
