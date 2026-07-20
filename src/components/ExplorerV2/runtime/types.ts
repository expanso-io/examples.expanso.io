export type RuntimePriority = 'critical' | 'normal';
export type RuntimeConnection = 'online' | 'offline';

export interface RuntimeRecord {
  id: string;
  priority: RuntimePriority;
}

export type RuntimeEvent =
  | {
      id: string;
      kind: 'record-arrived';
      at: number;
      record: RuntimeRecord;
    }
  | {
      id: string;
      kind: 'link-state';
      at: number;
      connection: RuntimeConnection;
    }
  | {
      id: string;
      kind: 'replay-buffer';
      at: number;
    };

export interface RuntimeScenario {
  id: string;
  label: string;
  description: string;
  deterministicSeed: string;
  initialConnection: RuntimeConnection;
  events: RuntimeEvent[];
}

export interface RuntimeSource {
  schemaVersion: '1.0.0';
  exampleId: string;
  timelineUnit: 'event';
  modeledBehaviors: string[];
  scenarios: RuntimeScenario[];
}

export interface DeliveredRecord extends RuntimeRecord {
  via: 'direct' | 'buffer-replay';
}

export interface RuntimeState {
  tick: number;
  connection: RuntimeConnection;
  queue: RuntimeRecord[];
  delivered: DeliveredRecord[];
  processedEventIds: string[];
}

export type RuntimeAssertion =
  | {
      id: string;
      label: string;
      path: '/connection';
      equals: RuntimeConnection;
    }
  | {
      id: string;
      label: string;
      path: '/queue/ids' | '/delivered/ids';
      equals: string[];
    };

export interface RuntimeCheckpoint {
  index: number;
  eventId: string | null;
  state: RuntimeState;
  assertions: RuntimeAssertion[];
}

export interface RuntimeCheckpointScenario {
  scenarioId: string;
  checkpoints: RuntimeCheckpoint[];
}

export interface RuntimeCheckpointArtifact {
  schemaVersion: '1.0.0';
  exampleId: string;
  scenarios: RuntimeCheckpointScenario[];
}

export interface RuntimeProofEvidence {
  schemaVersion: '1.0.0';
  exampleId: string;
  kind: 'deterministic-simulation';
  verificationId: string;
  sourcePath: string;
  sourceSha256: `sha256:${string}`;
  checkpointPath: string;
  checkpointSha256: `sha256:${string}`;
  stateMachinePath: string;
  stateMachineSha256: `sha256:${string}`;
  command: string;
  environment: string;
  generatedAt: string;
  verifierAgentId: string;
  toolVersions: {
    node: string;
    tsx: string;
    typescript: string;
    react: string;
    playwright: string;
    axeCore: string;
  };
  modeledBehaviors: string[];
  excludedClaims: string[];
}
