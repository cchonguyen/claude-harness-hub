export interface SessionHandoffSummary {
  lastPlatform: string;
  activeBranchState: string;
  filesModified: string;
  verificationStatus: string;
  immediateNextStep: string;
  activeSlice: string;
  updatedAt: string | null;
}

export interface HarnessStatus {
  version: string;
  hubConfig: {
    repo: string;
    owner: string;
    branch: string;
  };
  mode: 'vibe' | 'slice' | 'conflict';
  activeCount: number;
  activeLines: string[];
  hasSliceCheckpoint: boolean;
  checkpoints: Record<
    string,
    {
      sha: string;
      green: boolean;
      updatedAt: string;
    }
  >;
  strikes: Record<
    string,
    {
      strikes: number;
      lastSig: string;
      updatedAt: string;
    }
  >;
  root: string;
  progressMtime: string | null;
  sessionHandoff: SessionHandoffSummary;
}

export type FileOwnership = 'editable' | 'template' | 'harness-owned';

export interface SpecFile {
  path: string;
  exists: boolean;
  content: string;
  mtime: string | null;
  size: number;
  lineCount: number;
  ownership: FileOwnership;
  ownershipLabel: string;
  readOnly: boolean;
}

export interface Agent {
  id: string;
  file: string;
  name: string;
  description: string;
  model: string;
  tools: string;
  body: string;
}

export interface CommandDoc {
  id: string;
  name: string;
  description: string;
  argumentHint: string;
  allowedTools: string;
  disableModelInvocation: boolean;
  body: string;
}

export interface RunnerClassification {
  command: string;
  isTestOrBuild: boolean;
  advancesGreen: boolean;
  reason: string;
}

export type AllowListedCommandId = 'unit-tests' | 'typecheck' | 'lint';

export interface TestRunRecord {
  commandId: AllowListedCommandId;
  commandLabel: string;
  success: boolean;
  stdout: string;
  stderr?: string;
  durationMs: number;
  ranAt: string;
}

export interface HandoffState {
  exists: boolean;
  mode: HandoffMode;
  receipt: string | null;
  packetContent: string;
  lineCount: number;
  includedFiles: string[];
  packetMtime: string | null;
  progressMtime: string | null;
  isStale: boolean;
  staleReason: string | null;
}

export interface SpokeDiffItem {
  path: string;
  status:
    | 'identical'
    | 'modified'
    | 'missing-in-spoke'
    | 'extra-in-spoke'
    | 'template-preserved'
    | 'template-missing';
}

export interface SpokeStatus {
  isHubRepo: boolean;
  hubAttached: boolean;
  attachMethod: 'self-hub' | 'sibling' | 'git-remote' | 'unattached';
  hubPath: string | null;
  hubConfig: {
    repo: string;
    owner: string;
    branch: string;
  };
  engineMatches: boolean;
  filesChecked: number;
  differences: SpokeDiffItem[];
  summary: string;
  checkedAt: string;
}

export type TabId =
  | 'overview'
  | 'runner'
  | 'agents'
  | 'commands'
  | 'handoff'
  | 'specs'
  | 'spoke'
  | 'security';

export type HandoffMode = 'spec' | 'diff' | 'arch' | 'overview';

export type SliceActionType = 'activate' | 'complete' | 'uncheck' | 'clear-all';

export interface NewSliceInput {
  number: string;
  description: string;
  isCore: boolean;
  targetFiles: string;
}

export interface ParsedSlice {
  index: number;
  completed: boolean;
  inProgress: boolean;
  title: string;
  tag: string;
  description: string;
  targetFiles: string;
  raw: string;
}
