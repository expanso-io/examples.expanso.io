import type { CanonicallyBoundStage } from '../DataPipelineExplorer/types';

export type ExplorerProvenanceKind =
  | 'executed-pipeline'
  | 'deterministic-simulation'
  | 'curated-explanation';

export interface ExplorerProvenance {
  exampleId: string;
  kind: ExplorerProvenanceKind;
  verificationId: string;
  schemaDigest: `sha256:${string}`;
  canonicalPipelinePath: string;
  pipelineSha256: `sha256:${string}`;
  fixturePath: string;
  fixtureSha256: `sha256:${string}`;
  outputOrCheckpointPath: string;
  outputOrCheckpointSha256: `sha256:${string}`;
  command: string;
  environment: string;
  toolVersions: Readonly<Record<string, string>>;
  generatedAt: string;
  verifierLane: string;
  executionStatus:
    | 'offline-runnable'
    | 'requires-integration'
    | 'architecture-only';
  operationalEvidence:
    | 'not-assessed'
    | 'component-tested'
    | 'operating-envelope-tested';
}

export interface ExplorerPresentation {
  kind: ExplorerProvenanceKind;
  label: string;
  executionStatus: ExplorerProvenance['executionStatus'];
  operationalEvidence: ExplorerProvenance['operationalEvidence'];
  fixtureLabel: string;
}
export type ExplorerDiffState = 'added' | 'removed' | 'changed' | 'unchanged';
export type ExplorerPayloadFormat =
  | 'json'
  | 'text'
  | 'binary'
  | 'tabular'
  | 'route';

export interface ExplorerLine {
  content: string;
  indent: number;
  state: ExplorerDiffState;
}

export interface ExplorerStage {
  slug: string;
  title: string;
  description: string;
  inputLines: ExplorerLine[];
  outputLines: ExplorerLine[];
  yamlCode: string;
  yamlFilename: string;
  provenance: ExplorerProvenanceKind;
  inputFormat?: ExplorerPayloadFormat;
  outputFormat?: ExplorerPayloadFormat;
  rawInput?: string;
  rawOutput?: string;
  comparisonMode?: 'diff' | 'highlights';
}

export interface ExplorerV2Props {
  exampleId: string;
  stages: readonly (ExplorerStage | CanonicallyBoundStage)[];
  title: string;
  subtitle?: string;
  fullYaml?: string;
  fullYamlFilename?: string;
  presentation: ExplorerPresentation;
  comparisonMode?: 'diff' | 'highlights';
}
