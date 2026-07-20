import type {
  Difficulty as ExampleDifficulty,
  ExecutionStatus,
  OperationalEvidence,
} from '../../catalog/schema';

export interface ExampleAction {
  href: string;
  label: string;
}

export interface ExamplePageMeta {
  difficulty: ExampleDifficulty;
  executionStatus: ExecutionStatus;
  expectedTime: {
    inspectMinutes: number;
    runMinutes?: number;
  };
  operationalEvidence: OperationalEvidence;
  verifiedAt: string;
}

export interface BoundaryNode {
  id: string;
  kind: 'expanso-native' | 'protocol-adapter' | 'custom' | 'external';
  label: string;
  location: string;
}

export interface BoundaryFlow {
  crossesBoundary: boolean;
  from: string;
  payload: string;
  to: string;
}

export type { ExampleDifficulty, ExecutionStatus, OperationalEvidence };
