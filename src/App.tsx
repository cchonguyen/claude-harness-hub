import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Lock,
  FolderGit2,
  AlertTriangle
} from 'lucide-react';
import {
  HarnessStatus,
  SpecFile,
  Agent,
  CommandDoc,
  RunnerClassification,
  TestRunRecord,
  AllowListedCommandId,
  HandoffState,
  SpokeStatus,
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
  getLastTestRun,
  runHarnessTests,
  getHandoffState,
  generateBundleHandoff,
  getSpokeStatus
} from './api';
import OverviewTab from './tabs/OverviewTab';
import RunnerTab from './tabs/RunnerTab';
import AgentsTab from './tabs/AgentsTab';
import CommandsTab from './tabs/CommandsTab';
import HandoffTab, { LastCopiedPacketRecord } from './tabs/HandoffTab';
import SpecsTab from './tabs/SpecsTab';
import SpokeTab from './tabs/SpokeTab';
import SecurityTab from './tabs/SecurityTab';

const LAST_TEST_STORAGE_KEY = 'harness_last_test_run_v1';
const LAST_PACKET_STORAGE_KEY = 'harness_last_copied_packet_v1';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [pendingTabSwitch, setPendingTabSwitch] = useState<TabId | null>(null);
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

  // Runner sandbox & persistent test result state
  const [runnerInput, setRunnerInput] = useState('npm test');
  const [runnerResult, setRunnerResult] = useState<RunnerClassification | null>(null);
  const [lastTestRun, setLastTestRun] = useState<TestRunRecord | null>(() => {
    try {
      const raw = localStorage.getItem(LAST_TEST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [runningTests, setRunningTests] = useState(false);

  // Handoff state & persistent last copied packet
  const [handoffMode, setHandoffMode] = useState<HandoffMode>('spec');
  const [handoffState, setHandoffState] = useState<HandoffState | null>(null);
  const [lastCopiedPacket, setLastCopiedPacket] = useState<LastCopiedPacketRecord | null>(() => {
    try {
      const raw = localStorage.getItem(LAST_PACKET_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [generatingHandoff, setGeneratingHandoff] = useState(false);

  // Spoke status state
  const [spokeStatus, setSpokeStatus] = useState<SpokeStatus | null>(null);
  const [checkingSpoke, setCheckingSpoke] = useState(false);
  const [spokeName, setSpokeName] = useState('claude-harness-hub');
  const [spokeOwner, setSpokeOwner] = useState('cchonguyen');

  // Agents & Commands selection
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandDoc | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New slice modal state
  const [showNewSliceModal, setShowNewSliceModal] = useState(false);
  const [newSliceForm, setNewSliceForm] = useState<NewSliceInput>({
    number: '3',
    description: '',
    isCore: true,
    targetFiles: 'src/'
  });

  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getStatus();
      if (data) setStatus(data);
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

  const fetchHandoff = useCallback(async () => {
    try {
      const data = await getHandoffState();
      if (data) setHandoffState(data);
    } catch (e) {
      console.error('Failed to fetch handoff state', e);
    }
  }, []);

  const fetchSpoke = useCallback(async () => {
    setCheckingSpoke(true);
    try {
      const data = await getSpokeStatus();
      if (data) setSpokeStatus(data);
    } catch (e) {
      console.error('Failed to fetch spoke status', e);
    } finally {
      setCheckingSpoke(false);
    }
  }, []);

  const fetchAgentsAndCommands = useCallback(async () => {
    try {
      const [loadedAgents, loadedCommands, serverLastRun] = await Promise.all([
        getAgents(),
        getCommands(),
        getLastTestRun()
      ]);
      setAgents(loadedAgents);
      if (loadedAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(loadedAgents[0]);
      }
      setCommands(loadedCommands);
      if (loadedCommands.length > 0 && !selectedCommand) {
        setSelectedCommand(loadedCommands[0]);
      }
      if (serverLastRun) {
        setLastTestRun(serverLastRun);
        try {
          localStorage.setItem(LAST_TEST_STORAGE_KEY, JSON.stringify(serverLastRun));
        } catch {}
      }
    } catch (e) {
      console.error('Failed to fetch agents/commands', e);
    }
  }, [selectedAgent, selectedCommand]);

  const classifyCommand = useCallback(async (cmd: string) => {
    try {
      const data = await classifyRunnerCommand(cmd);
      if (data) setRunnerResult(data);
    } catch (e) {
      console.error('Failed to classify command', e);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchStatus(),
      fetchSpecFiles(),
      fetchHandoff(),
      fetchSpoke(),
      fetchAgentsAndCommands()
    ]).finally(() => {
      setLoading(false);
    });
  }, [fetchStatus, fetchSpecFiles, fetchHandoff, fetchSpoke, fetchAgentsAndCommands]);

  useEffect(() => {
    classifyCommand(runnerInput);
  }, [runnerInput, classifyCommand]);

  const currentSpecFileObj = specFiles.find((f) => f.path === selectedFile);
  const hasUnsavedSpecChanges = Boolean(
    currentSpecFileObj &&
      !currentSpecFileObj.readOnly &&
      editorContent !== currentSpecFileObj.content
  );

  const handleRequestTabChange = (nextTab: TabId) => {
    if (nextTab === activeTab) return;
    if (activeTab === 'specs' && hasUnsavedSpecChanges) {
      setPendingTabSwitch(nextTab);
      return;
    }
    setPendingTabSwitch(null);
    setActiveTab(nextTab);
  };

  const handleSelectSpecFile = (path: string) => {
    setSelectedFile(path);
    const found = specFiles.find((f) => f.path === path);
    if (found) {
      setEditorContent(found.content);
    }
    setSaveMessage(null);
  };

  const handleOpenSpecFromOverview = (path: string) => {
    handleSelectSpecFile(path);
    setActiveTab('specs');
  };

  const handleSaveSpecFile = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const ok = await saveSpecFile(selectedFile, editorContent);
      if (ok) {
        setSaveMessage('Saved & updated harness state');
        await Promise.all([fetchStatus(), fetchSpecFiles(), fetchHandoff()]);
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
        await Promise.all([fetchStatus(), fetchSpecFiles(), fetchHandoff()]);
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
        await Promise.all([fetchStatus(), fetchSpecFiles(), fetchHandoff()]);
      }
    } catch (err) {
      console.error('Failed to add slice', err);
    }
  };

  const handleRunAllowListed = async (cmdId: AllowListedCommandId) => {
    setRunningTests(true);
    try {
      const record = await runHarnessTests(cmdId);
      setLastTestRun(record);
      try {
        localStorage.setItem(LAST_TEST_STORAGE_KEY, JSON.stringify(record));
      } catch {}
    } catch (e) {
      const fallback: TestRunRecord = {
        commandId: cmdId,
        commandLabel: cmdId,
        success: false,
        stdout: '',
        stderr: `Error running check: ${String(e)}`,
        durationMs: 0,
        ranAt: new Date().toISOString()
      };
      setLastTestRun(fallback);
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
        setHandoffState(data);
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

  const handleCopyPacket = (packet: string) => {
    copyToClipboard(packet, 'full-packet');
    const record: LastCopiedPacketRecord = {
      content: packet,
      mode: handoffState?.mode || handoffMode,
      copiedAt: new Date().toISOString(),
      lineCount: packet.split('\n').length,
      includedFiles:
        handoffState?.includedFiles && handoffState.includedFiles.length > 0
          ? handoffState.includedFiles
          : ['.spec/OVERVIEW.md', '.spec/SYSTEM_SPEC.md', '.spec/PROGRESS.md'],
      progressMtimeAtCopy: status?.progressMtime || handoffState?.progressMtime || null
    };
    setLastCopiedPacket(record);
    try {
      localStorage.setItem(LAST_PACKET_STORAGE_KEY, JSON.stringify(record));
    } catch {}
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
        const desc = line
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
      icon: <Activity className="w-4 h-4 shrink-0" />,
      badge: status?.mode.toUpperCase()
    },
    {
      id: 'runner',
      label: 'Runner Matcher Lab',
      icon: <Terminal className="w-4 h-4 shrink-0" />,
      badge: lastTestRun ? (lastTestRun.success ? 'PASS' : 'FAIL') : '15 Tests'
    },
    {
      id: 'agents',
      label: 'Subagents',
      icon: <Cpu className="w-4 h-4 shrink-0" />,
      badge: String(agents.length || 4)
    },
    {
      id: 'commands',
      label: 'Slash Commands',
      icon: <Command className="w-4 h-4 shrink-0" />,
      badge: String(commands.length || 10)
    },
    {
      id: 'handoff',
      label: 'Handoff Bundler',
      icon: <Package className="w-4 h-4 shrink-0" />,
      badge: handoffState?.isStale ? 'STALE' : undefined
    },
    {
      id: 'specs',
      label: '.spec & Rules Studio',
      icon: <FileCode2 className="w-4 h-4 shrink-0" />,
      badge: hasUnsavedSpecChanges ? 'DIRTY' : undefined
    },
    {
      id: 'spoke',
      label: 'Spoke Sync & Bootstrap',
      icon: <GitBranch className="w-4 h-4 shrink-0" />,
      badge: spokeStatus?.hubAttached ? 'SYNCED' : undefined
    },
    {
      id: 'security',
      label: 'Security & Audit',
      icon: <Lock className="w-4 h-4 shrink-0" />,
      badge: 'B+'
    }
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % navItems.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + navItems.length) % navItems.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = navItems.length - 1;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab = navItems[nextIdx].id;
      tabButtonRefs.current[targetTab]?.focus();
      handleRequestTabChange(targetTab);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D12] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0D1117]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2.5 min-h-16 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-semibold tracking-tight text-slate-100 text-sm sm:text-base">
                  claude-harness-hub
                </h1>
                <span
                  title="Harness version from .harness-version"
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700"
                >
                  .harness-version: v{status?.version || '2.2.0'}
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                  <GitBranch className="w-3 h-3 text-slate-500" />
                  {status?.hubConfig.owner}/{status?.hubConfig.repo}@{status?.hubConfig.branch}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                <span
                  title={status?.root || ''}
                  className="inline-flex items-center gap-1 text-slate-300 truncate max-w-[260px] sm:max-w-[460px]"
                >
                  <FolderGit2 className="w-3 h-3 text-indigo-400 shrink-0" />
                  Repo: {status?.root || 'loading...'}
                </span>
              </div>
            </div>
          </div>

          {/* Live Mode Status Pill */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {status && (
              <div
                className={`flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg border text-[11px] sm:text-xs font-mono transition-colors ${
                  status.mode === 'vibe'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : status.mode === 'slice'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
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
              type="button"
              onClick={() => {
                fetchStatus();
                fetchSpecFiles();
                fetchHandoff();
                fetchSpoke();
              }}
              title="Refresh live repository state"
              aria-label="Refresh live repository state"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs with Keyboard Arrow Navigation */}
        <div
          role="tablist"
          aria-label="Harness Control Plane Tabs"
          className="max-w-[1600px] mx-auto px-2 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-800/50"
        >
          {navItems.map((item, idx) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  tabButtonRefs.current[item.id] = el;
                }}
                id={`tab-${item.id}`}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`panel-${item.id}`}
                tabIndex={active ? 0 : -1}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                onClick={() => handleRequestTabChange(item.id)}
                className={`flex items-center gap-2 px-3 sm:px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                  active
                    ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
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

      {/* Unsaved Changes Guard Banner When Switching Tabs */}
      {pendingTabSwitch && (
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                You have unsaved edits in <code className="font-mono text-white">{selectedFile}</code>.
                Stay in <strong>.spec &amp; Rules Studio</strong> to review &amp; save your diff, or
                discard changes to switch tabs?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setPendingTabSwitch(null)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
              >
                Stay &amp; Review Diff
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentSpecFileObj) {
                    setEditorContent(currentSpecFileObj.content);
                  }
                  const target = pendingTabSwitch;
                  setPendingTabSwitch(null);
                  setActiveTab(target);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-medium cursor-pointer"
              >
                Discard &amp; Switch Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-6"
      >
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
            onOpenSpecFile={handleOpenSpecFromOverview}
          />
        )}

        {activeTab === 'runner' && (
          <RunnerTab
            testCmdInput={runnerInput}
            classification={runnerResult}
            lastTestRun={lastTestRun}
            runningTests={runningTests}
            copiedText={copiedId}
            onChangeCmdInput={setRunnerInput}
            onRunAllowListed={handleRunAllowListed}
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
            handoffState={handoffState}
            lastCopiedPacket={lastCopiedPacket}
            currentProgressMtime={status?.progressMtime || null}
            generatingHandoff={generatingHandoff}
            copiedText={copiedId}
            onSelectMode={setHandoffMode}
            onGenerateHandoff={() => handleGenerateHandoff(handoffMode)}
            onCopyPacket={handleCopyPacket}
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
            spokeStatus={spokeStatus}
            checkingSpoke={checkingSpoke}
            spokeName={spokeName}
            spokeOwner={spokeOwner}
            copiedText={copiedId}
            onRefreshSpokeStatus={fetchSpoke}
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
                type="button"
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
