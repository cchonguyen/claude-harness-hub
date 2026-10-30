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
  checkpoints: Record<string, {
    sha: string;
    green: boolean;
    updatedAt: string;
  }>;
  strikes: Record<string, {
    strikes: number;
    lastSig: string;
    updatedAt: string;
  }>;
  root: string;
}

export interface SpecFile {
  path: string;
  exists: boolean;
  content: string;
  mtime: string | null;
  size: number;
  lineCount: number;
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
