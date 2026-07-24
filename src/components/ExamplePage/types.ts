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

export type { ExampleDifficulty, ExecutionStatus, OperationalEvidence };
