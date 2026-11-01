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

// Read-only preview: built with VITE_READ_ONLY=true. Reads come from snapshot JSON files
// in public/snapshot/, and every write is refused without touching the network.
const READ_ONLY = import.meta.env.VITE_READ_ONLY === 'true';
const READ_ONLY_MESSAGE = 'Read-only preview: changes are disabled.';

const readGet = (apiPath: string, snapshotName: string) =>
  READ_ONLY ? fetch(`/snapshot/${snapshotName}.json`) : fetch(apiPath);

export async function getStatus(): Promise<HarnessStatus | null> {
  const res = await readGet('/api/status', 'status');
  if (!res.ok) return null;
  return res.json();
}

export async function getSpecFiles(): Promise<SpecFile[]> {
  const res = await readGet('/api/spec-files', 'spec-files');
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

export async function saveSpecFile(filePath: string, content: string): Promise<boolean> {
  if (READ_ONLY) return false;
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
  if (READ_ONLY) return false;
  const res = await fetch('/api/progress/slice-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, sliceIndex })
  });
  return res.ok;
}

export async function addSlice(newSlice: NewSliceInput): Promise<boolean> {
  if (READ_ONLY) return false;
  const res = await fetch('/api/progress/slice-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', newSlice })
  });
  return res.ok;
}

export async function getAgents(): Promise<Agent[]> {
  const res = await readGet('/api/agents', 'agents');
  if (!res.ok) return [];
  const data = await res.json();
  return data.agents || [];
}

export async function getCommands(): Promise<CommandDoc[]> {
  const res = await readGet('/api/commands', 'commands');
  if (!res.ok) return [];
  const data = await res.json();
  return data.commands || [];
}

export async function classifyRunnerCommand(
  command: string
): Promise<RunnerClassification | null> {
  if (READ_ONLY) return null;
  const res = await fetch('/api/runner/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getLastTestRun(): Promise<TestRunRecord | null> {
  const res = await readGet('/api/tests/last', 'tests-last');
  if (!res.ok) return null;
  const data = await res.json();
  return data.lastRun || null;
}

export async function runHarnessTests(
  commandId: AllowListedCommandId = 'unit-tests'
): Promise<TestRunRecord> {
  if (READ_ONLY) throw new Error(READ_ONLY_MESSAGE);
  const res = await fetch('/api/tests/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandId })
  });
  return res.json();
}

export async function getHandoffState(): Promise<HandoffState | null> {
  const res = await readGet('/api/handoff-state', 'handoff-state');
  if (!res.ok) return null;
  return res.json();
}

export async function generateBundleHandoff(mode: HandoffMode): Promise<HandoffState | null> {
  if (READ_ONLY) return null;
  const res = await fetch('/api/bundle-handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getSpokeStatus(): Promise<SpokeStatus | null> {
  const res = await readGet('/api/spoke-status', 'spoke-status');
  if (!res.ok) return null;
  return res.json();
}
