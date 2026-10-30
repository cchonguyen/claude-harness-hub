import {
  HarnessStatus,
  SpecFile,
  Agent,
  CommandDoc,
  RunnerClassification,
  HandoffMode,
  HandoffState,
  SpokeStatus,
  TestRunRecord,
  AllowListedCommandId,
  SliceActionType,
  NewSliceInput
} from './types';

export async function getStatus(): Promise<HarnessStatus | null> {
  const res = await fetch('/api/status');
  if (!res.ok) return null;
  return res.json();
}

export async function getSpecFiles(): Promise<SpecFile[]> {
  const res = await fetch('/api/spec-files');
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

export async function saveSpecFile(filePath: string, content: string): Promise<boolean> {
  const res = await fetch('/api/spec-file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, content })
  });
  return res.ok;
}

export async function performSliceAction(
  action: SliceActionType,
  sliceIndex?: number
): Promise<boolean> {
  const res = await fetch('/api/progress/slice-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, sliceIndex })
  });
  return res.ok;
}

export async function addSlice(newSlice: NewSliceInput): Promise<boolean> {
  const res = await fetch('/api/progress/slice-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', newSlice })
  });
  return res.ok;
}

export async function getAgents(): Promise<Agent[]> {
  const res = await fetch('/api/agents');
  if (!res.ok) return [];
  const data = await res.json();
  return data.agents || [];
}

export async function getCommands(): Promise<CommandDoc[]> {
  const res = await fetch('/api/commands');
  if (!res.ok) return [];
  const data = await res.json();
  return data.commands || [];
}

export async function classifyRunnerCommand(
  command: string
): Promise<RunnerClassification | null> {
  const res = await fetch('/api/runner/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getLastTestRun(): Promise<TestRunRecord | null> {
  const res = await fetch('/api/tests/last');
  if (!res.ok) return null;
  const data = await res.json();
  return data.lastRun || null;
}

export async function runHarnessTests(
  commandId: AllowListedCommandId = 'unit-tests'
): Promise<TestRunRecord> {
  const res = await fetch('/api/tests/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandId })
  });
  return res.json();
}

export async function getHandoffState(): Promise<HandoffState | null> {
  const res = await fetch('/api/handoff-state');
  if (!res.ok) return null;
  return res.json();
}

export async function generateBundleHandoff(mode: HandoffMode): Promise<HandoffState | null> {
  const res = await fetch('/api/bundle-handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getSpokeStatus(): Promise<SpokeStatus | null> {
  const res = await fetch('/api/spoke-status');
  if (!res.ok) return null;
  return res.json();
}
