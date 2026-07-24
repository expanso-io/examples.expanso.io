/**
 * Public catalog contract.
 *
 * This module is safe to import from the browser bundle. It deliberately
 * contains only public allowlisted vocabulary and structural types; private
 * demand and verification evidence belongs outside this repository.
 */

export const CATALOG_SCHEMA_VERSION = '1.0.0' as const;

export const VERIFICATION_POLICY = {
  policyVersion: '1.0.0',
  technicalReviewExpiresAfterMonths: 6,
  editorialReviewExpiresAfterMonths: 12,
  unsupportedOperationalEvidence: 'not-assessed',
  publicProjection: 'allowlist-only',
} as const;

// SHA-256 of the canonical JSON serialization of VERIFICATION_POLICY.
export const VERIFICATION_POLICY_DIGEST =
  'sha256:1051481baf4c0bf7d1b977fdfafb1149bc069e4989b73f05f1aa32ce384cc808' as const;

export type ExecutionStatus =
  | 'offline-runnable'
  | 'requires-integration'
  | 'architecture-only';

export type OperationalEvidence =
  | 'not-assessed'
  | 'component-tested'
  | 'operating-envelope-tested';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type Interaction =
  | 'transform'
  | 'runtime-simulation'
  | 'architecture'
  | 'none';

export const EXPLORER_EVIDENCE_SCHEMA = {
  schemaVersion: '2.0.0',
  requiredFields: [
    'exampleId',
    'kind',
    'verificationId',
    'schemaDigest',
    'canonicalPipelinePath',
    'pipelineSha256',
    'bindingManifestPath',
    'bindingManifestSha256',
    'authoredStageModulePath',
    'authoredStageModuleSha256',
    'inputCheckpointPath',
    'inputCheckpointSha256',
    'outputCheckpointPath',
    'outputCheckpointSha256',
    'fidelityOraclePath',
    'fidelityOracleSha256',
    'semanticsVerifierPath',
    'semanticsVerifierSha256',
    'stageCount',
    'command',
    'environment',
    'toolVersions',
    'generatedAt',
    'verifierLane',
    'executionStatus',
    'operationalEvidence',
  ],
  strengthenedFidelityFields: [
    'fixturePath',
    'fixtureSha256',
    'outputOrCheckpointPath',
    'outputOrCheckpointSha256',
    'fidelityContractId',
    'processorCount',
    'checkpointCount',
    'fixtureEnvironmentPath',
    'fixtureEnvironmentSha256',
    'expectedOutputPath',
    'expectedOutputSha256',
  ],
} as const;

export const EXPLORER_EVIDENCE_SCHEMA_DIGEST =
  'sha256:7a502149249c39ad27263e9d22eaec485c2287755563b626df423dd47b762a01' as const;

export type ExplorerProvenanceKind =
  | 'executed-pipeline'
  | 'deterministic-simulation'
  | 'curated-explanation';

export interface ExplorerEvidence {
  exampleId: string;
  kind: ExplorerProvenanceKind;
  verificationId: string;
  schemaDigest: typeof EXPLORER_EVIDENCE_SCHEMA_DIGEST;
  canonicalPipelinePath: string;
  pipelineSha256: `sha256:${string}`;
  bindingManifestPath: string;
  bindingManifestSha256: `sha256:${string}`;
  authoredStageModulePath: string;
  authoredStageModuleSha256: `sha256:${string}`;
  inputCheckpointPath: string;
  inputCheckpointSha256: `sha256:${string}`;
  outputCheckpointPath: string;
  outputCheckpointSha256: `sha256:${string}`;
  fidelityOraclePath: string;
  fidelityOracleSha256: `sha256:${string}`;
  semanticsVerifierPath: string;
  semanticsVerifierSha256: `sha256:${string}`;
  stageCount: number;
  command: string;
  environment: string;
  toolVersions: Record<string, string>;
  generatedAt: string;
  verifierLane: AgentLane;
  executionStatus: ExecutionStatus;
  operationalEvidence: OperationalEvidence;
  fixturePath?: string;
  fixtureSha256?: `sha256:${string}`;
  outputOrCheckpointPath?: string;
  outputOrCheckpointSha256?: `sha256:${string}`;
  fidelityContractId?: string;
  processorCount?: number;
  checkpointCount?: number;
  fixtureEnvironmentPath?: string;
  fixtureEnvironmentSha256?: `sha256:${string}`;
  expectedOutputPath?: string;
  expectedOutputSha256?: `sha256:${string}`;
}

export type ExampleStatus = 'published' | 'draft' | 'deprecated';

export type TopologyNodeKind =
  | 'expanso-native'
  | 'protocol-adapter'
  | 'custom'
  | 'external';

export type DataClassification =
  | 'synthetic'
  | 'public'
  | 'operational'
  | 'sensitive';

export const AGENT_LANES = [
  'accessibility',
  'adversarial-verifier',
  'claims-evidence',
  'dataset-privacy',
  'design',
  'editorial',
  'engineering',
  'product-semantics',
] as const;

export type AgentLane = (typeof AGENT_LANES)[number];

export const REMOVE_PII_EXPLORER_EVIDENCE = {
  exampleId: 'remove-pii',
  kind: 'curated-explanation',
  verificationId: 'remove-pii-curated-fidelity-v1',
  schemaDigest: EXPLORER_EVIDENCE_SCHEMA_DIGEST,
  canonicalPipelinePath: 'examples/data-security/remove-pii-complete.yaml',
  pipelineSha256:
    'sha256:d70b31e982b67a9a04c3269ebfa6ed8f6961c0f7664919534a0f4cb760e63b96',
  bindingManifestPath: 'content/explorer-stage-bindings-v1.json',
  bindingManifestSha256:
    'sha256:77c076256471a13df69caa254c1aa963b968e95f0f8e091370dcd21f6e64b10b',
  authoredStageModulePath: 'docs/data-security/remove-pii-full.stages.ts',
  authoredStageModuleSha256:
    'sha256:403e909acfed726fbae5ca5b63e38c8cd85c3ade30efea6fdc647ec0368d832e',
  inputCheckpointPath: 'examples/data-security/remove-pii/sample-data.json',
  inputCheckpointSha256:
    'sha256:f27d41e0954e0501730fd1c718b4b4c885fb839ba73af7971ea0351732d5dab2',
  outputCheckpointPath:
    'examples/data-security/remove-pii/expected-output.jsonl',
  outputCheckpointSha256:
    'sha256:189eeefe48eb725e12d480d67e87278db2f588b1b38d18a666e69499fbcf10e3',
  fixturePath: 'examples/data-security/remove-pii/sample-data.json',
  fixtureSha256:
    'sha256:f27d41e0954e0501730fd1c718b4b4c885fb839ba73af7971ea0351732d5dab2',
  outputOrCheckpointPath: 'docs/data-security/remove-pii-full.stages.ts',
  outputOrCheckpointSha256:
    'sha256:403e909acfed726fbae5ca5b63e38c8cd85c3ade30efea6fdc647ec0368d832e',
  fidelityContractId: 'remove-pii-explorer-fidelity-v1',
  fidelityOraclePath: 'scripts/quality/remove-pii-fidelity.ts',
  fidelityOracleSha256:
    'sha256:b795cfc4e9d6efb141382b4ba4d5959b6937962c5738ea2f7234808c9e474808',
  semanticsVerifierPath: 'scripts/quality/verify-explorer-provenance.ts',
  semanticsVerifierSha256:
    'sha256:5458ba33de76335c743a700ad91aa6d0b4489776bfbe3a91587468122bc87555',
  stageCount: 6,
  processorCount: 5,
  checkpointCount: 6,
  fixtureEnvironmentPath:
    'examples/data-security/remove-pii/fixture-environment.json',
  fixtureEnvironmentSha256:
    'sha256:4d2bec15465fdc8731c1d4e205e2aae834faf6ecdaa399f65c6f2c512ddb4c99',
  expectedOutputPath: 'examples/data-security/remove-pii/expected-output.jsonl',
  expectedOutputSha256:
    'sha256:189eeefe48eb725e12d480d67e87278db2f588b1b38d18a666e69499fbcf10e3',
  command: 'npm run validate-catalog',
  environment: 'phase1-foundation-node-20.19.4',
  toolVersions: {
    docusaurus: '3.9.2',
    node: '20.19.4',
  },
  generatedAt: '2026-07-18T20:27:45Z',
  verifierLane: 'product-semantics',
  executionStatus: 'offline-runnable',
  operationalEvidence: 'not-assessed',
} as const satisfies ExplorerEvidence;

export interface FacetDefinition {
  id: string;
  label: string;
  definition: string;
  aliases: readonly string[];
  maintainingAgentLane: AgentLane;
}

export const GOAL_FACETS = [
  {
    id: 'analyze-edge-data',
    label: 'Analyze edge data',
    definition: 'Prepare or summarize distributed data for analysis.',
    aliases: ['analytics', 'edge analytics'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'migrate-data',
    label: 'Migrate data',
    definition: 'Move or preserve data across storage and platform boundaries.',
    aliases: ['backup', 'etl', 'migration'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'operate-resiliently',
    label: 'Operate reliably',
    definition:
      'Keep data moving through failures, backlog, or constrained links.',
    aliases: ['buffering', 'resilience', 'reliability'],
    maintainingAgentLane: 'engineering',
  },
  {
    id: 'process-logs',
    label: 'Process logs',
    definition: 'Parse, enrich, reduce, or deliver logs.',
    aliases: ['logging', 'observability'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'route-data',
    label: 'Route data',
    definition:
      'Select one or more destinations from message content or policy.',
    aliases: ['fan out', 'routing'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'secure-data',
    label: 'Protect data',
    definition: 'Minimize, validate, pseudonymize, or encrypt data.',
    aliases: ['compliance', 'privacy', 'security'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'transform-data',
    label: 'Transform data',
    definition: 'Normalize, aggregate, parse, convert, or deduplicate records.',
    aliases: ['data quality', 'format conversion'],
    maintainingAgentLane: 'product-semantics',
  },
] as const satisfies readonly FacetDefinition[];

export const INDUSTRY_FACETS = [
  {
    id: 'cross-industry',
    label: 'Cross-industry',
    definition: 'Applicable without an industry-specific system boundary.',
    aliases: ['general'],
    maintainingAgentLane: 'editorial',
  },
  {
    id: 'energy-utilities',
    label: 'Energy and utilities',
    definition: 'Electricity, energy, and utility operational systems.',
    aliases: ['energy', 'power', 'utilities'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'financial-services',
    label: 'Financial services',
    definition: 'Banking, payment, and financial-data systems.',
    aliases: ['banking', 'finance', 'payments'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    definition: 'Healthcare delivery and medical-device systems.',
    aliases: ['medical'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'retail',
    label: 'Retail',
    definition: 'Store, point-of-sale, and retail analytics systems.',
    aliases: ['point of sale', 'pos'],
    maintainingAgentLane: 'editorial',
  },
  {
    id: 'telecommunications',
    label: 'Telecommunications',
    definition: 'Radio access and telecommunications operations.',
    aliases: ['o-ran', 'telco'],
    maintainingAgentLane: 'product-semantics',
  },
] as const satisfies readonly FacetDefinition[];

export const LOCATION_FACETS = [
  {
    id: 'cloud-account',
    label: 'Cloud account',
    definition: 'A service or destination controlled in a cloud account.',
    aliases: ['cloud'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'edge-to-cloud',
    label: 'Edge to cloud',
    definition:
      'A data path that crosses from an edge location to cloud services.',
    aliases: ['cloud edge'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'multi-site',
    label: 'Multi-site',
    definition: 'A deployment spanning more than one physical site.',
    aliases: ['distributed sites'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'on-device',
    label: 'On device',
    definition: 'A processor or data source running on a device.',
    aliases: ['device'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'on-premises',
    label: 'On premises',
    definition: 'A system operating inside a local facility or data center.',
    aliases: ['on prem', 'on-prem'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'remote-site',
    label: 'Remote site',
    definition: 'A physically remote operational site with an edge runtime.',
    aliases: ['branch', 'field site'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'vehicle',
    label: 'Vehicle',
    definition: 'A mobile deployment hosted in a vehicle.',
    aliases: ['fleet'],
    maintainingAgentLane: 'product-semantics',
  },
] as const satisfies readonly FacetDefinition[];

export const PORTFOLIO_FACETS = [
  {
    id: 'recipe',
    label: 'Recipes',
    definition: 'Focused patterns that can be adapted independently.',
    aliases: ['pattern'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'scenario',
    label: 'Scenario architectures',
    definition: 'Architectures that connect a complete operational scenario.',
    aliases: ['solution architecture'],
    maintainingAgentLane: 'product-semantics',
  },
] as const satisfies readonly FacetDefinition[];

export const DIFFICULTY_FACETS = [
  {
    id: 'beginner',
    label: 'Beginner',
    definition:
      'Offline core path with no external service or custom processor.',
    aliases: ['introductory'],
    maintainingAgentLane: 'editorial',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    definition: 'One service or adapter, or several configuration choices.',
    aliases: [],
    maintainingAgentLane: 'editorial',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    definition: 'Multiple systems, custom code or nontrivial assumptions.',
    aliases: ['complex'],
    maintainingAgentLane: 'editorial',
  },
] as const satisfies readonly FacetDefinition[];

export const EXECUTION_STATUS_FACETS = [
  {
    id: 'offline-runnable',
    label: 'Runs offline',
    definition: 'A deterministic core path runs without an external service.',
    aliases: ['local'],
    maintainingAgentLane: 'engineering',
  },
  {
    id: 'requires-integration',
    label: 'Needs integration',
    definition: 'Running requires a declared external integration.',
    aliases: ['external dependency'],
    maintainingAgentLane: 'engineering',
  },
  {
    id: 'architecture-only',
    label: 'Architecture only',
    definition:
      'The repository validates the architecture, not a runnable path.',
    aliases: ['design reference'],
    maintainingAgentLane: 'engineering',
  },
] as const satisfies readonly FacetDefinition[];

export const OPERATIONAL_EVIDENCE_FACETS = [
  {
    id: 'not-assessed',
    label: 'Not assessed',
    definition: 'No operational evidence is claimed.',
    aliases: ['unassessed'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'component-tested',
    label: 'Components tested',
    definition: 'Declared components have governed test evidence.',
    aliases: ['tested'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'operating-envelope-tested',
    label: 'Envelope tested',
    definition: 'A declared operating envelope has governed test evidence.',
    aliases: ['operationally tested'],
    maintainingAgentLane: 'claims-evidence',
  },
] as const satisfies readonly FacetDefinition[];

export const INTERACTION_FACETS = [
  {
    id: 'transform',
    label: 'Transformation',
    definition: 'Compare deterministic input and output transformations.',
    aliases: ['diff'],
    maintainingAgentLane: 'design',
  },
  {
    id: 'runtime-simulation',
    label: 'Runtime simulation',
    definition: 'Replay a deterministic runtime state machine.',
    aliases: ['simulation'],
    maintainingAgentLane: 'design',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    definition: 'Inspect systems, boundaries and configuration choices.',
    aliases: ['topology'],
    maintainingAgentLane: 'design',
  },
  {
    id: 'none',
    label: 'Reference',
    definition: 'Read a reference without an interactive Explorer.',
    aliases: ['documentation'],
    maintainingAgentLane: 'design',
  },
] as const satisfies readonly FacetDefinition[];

export const INSPECT_TIME_FACETS = [
  {
    id: 'quick',
    label: '3 min or less',
    definition: 'Expected inspection time is at most three minutes.',
    aliases: ['quick'],
    maintainingAgentLane: 'editorial',
  },
  {
    id: 'standard',
    label: '4–5 min',
    definition: 'Expected inspection time is four or five minutes.',
    aliases: ['standard'],
    maintainingAgentLane: 'editorial',
  },
  {
    id: 'deep',
    label: '6+ min',
    definition: 'Expected inspection time is at least six minutes.',
    aliases: ['deep'],
    maintainingAgentLane: 'editorial',
  },
] as const satisfies readonly FacetDefinition[];

export interface ComponentDefinition {
  id: string;
  label: string;
  definition: string;
  aliases: readonly string[];
  maintainingAgentLane: AgentLane;
}

export const COMPONENTS = [
  {
    id: 'analytics-destination',
    label: 'Analytics destination',
    definition: 'A generic downstream system used for analytical workloads.',
    aliases: ['analytics system'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'amazon-s3',
    label: 'Amazon S3',
    definition: 'Amazon object storage used as a data source or destination.',
    aliases: ['s3'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'anthropic-claude',
    label: 'Claude',
    definition: 'The Anthropic Claude API used as an external model service.',
    aliases: ['anthropic'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'db2',
    label: 'IBM Db2',
    definition: 'An IBM Db2 database used as a structured-data source.',
    aliases: ['ibm db2'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'elasticsearch',
    label: 'Elasticsearch',
    definition: 'An Elasticsearch cluster used for indexed search data.',
    aliases: [],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'expanso-runtime',
    label: 'Expanso runtime',
    definition: 'The Expanso-native runtime that executes a pipeline.',
    aliases: ['bacalhau', 'expanso'],
    maintainingAgentLane: 'engineering',
  },
  {
    id: 'fleet-management',
    label: 'Fleet management system',
    definition:
      'An external system that receives device or maintenance records.',
    aliases: [],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'google-bigquery',
    label: 'Google BigQuery',
    definition: 'Google BigQuery used as a cloud analytics destination.',
    aliases: ['bigquery'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'grafana',
    label: 'Grafana',
    definition: 'Grafana used as an external observability destination.',
    aliases: [],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'http-service',
    label: 'HTTP service',
    definition: 'A generic downstream service reached over HTTP.',
    aliases: ['api', 'downstream service'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'kafka',
    label: 'Apache Kafka',
    definition: 'Apache Kafka used as a streaming source or destination.',
    aliases: [],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'local-file',
    label: 'Local file',
    definition: 'A file on the local host used as a source or destination.',
    aliases: ['file'],
    maintainingAgentLane: 'engineering',
  },
  {
    id: 'motherduck',
    label: 'MotherDuck',
    definition: 'MotherDuck used as an external analytical query layer.',
    aliases: ['ducklake'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    definition: 'A PostgreSQL database used as a structured-data source.',
    aliases: ['postgres'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'redis',
    label: 'Redis',
    definition: 'Redis used for shared cache or state.',
    aliases: ['cache'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'scada-gateway',
    label: 'SCADA gateway',
    definition: 'A gateway that exposes SCADA or Modbus telemetry.',
    aliases: ['modbus gateway'],
    maintainingAgentLane: 'product-semantics',
  },
  {
    id: 'splunk-hec',
    label: 'Splunk HEC',
    definition: 'A Splunk HTTP Event Collector used as a log destination.',
    aliases: ['splunk'],
    maintainingAgentLane: 'claims-evidence',
  },
  {
    id: 'standard-input',
    label: 'Standard input',
    definition: 'Process standard input used as a local stream source.',
    aliases: ['stdin'],
    maintainingAgentLane: 'engineering',
  },
  {
    id: 'standard-output',
    label: 'Standard output',
    definition: 'Process standard output used as a local stream destination.',
    aliases: ['stdout'],
    maintainingAgentLane: 'engineering',
  },
  {
    id: 'synthetic-generator',
    label: 'Synthetic data generator',
    definition: 'A generator that emits public-safe synthetic fixture records.',
    aliases: ['generated data'],
    maintainingAgentLane: 'dataset-privacy',
  },
] as const satisfies readonly ComponentDefinition[];

export type GoalFacetId = (typeof GOAL_FACETS)[number]['id'];
export type IndustryFacetId = (typeof INDUSTRY_FACETS)[number]['id'];
export type LocationFacetId = (typeof LOCATION_FACETS)[number]['id'];
export type ComponentId = (typeof COMPONENTS)[number]['id'];

export interface PublicVerification {
  source: string;
  version?: string;
  verifiedAt: string;
}

export interface TopologyNode {
  id: string;
  label: string;
  kind: TopologyNodeKind;
  location: LocationFacetId;
  componentId?: ComponentId;
  requiredForCorePath: boolean;
  publicVerification?: PublicVerification;
}

export interface TopologyFlow {
  from: string;
  to: string;
  payload: string;
  dataClassification: DataClassification;
  crossesBoundary: boolean;
}

export interface ExampleRecord {
  id: string;
  producerLane: AgentLane;
  verifierLane: AgentLane;
  verificationPolicyDigest: typeof VERIFICATION_POLICY_DIGEST;
  title: string;
  oneLineOutcome: string;
  primaryGoal: GoalFacetId;
  goals: GoalFacetId[];
  industries: IndustryFacetId[];
  topology: {
    nodes: TopologyNode[];
    flows: TopologyFlow[];
  };
  difficulty: Difficulty;
  expectedTime: {
    inspectMinutes: number;
    runMinutes?: number;
    assumptions: string;
  };
  executionStatus: ExecutionStatus;
  operationalEvidence: OperationalEvidence;
  interaction: Interaction;
  routes: {
    overview: string;
    explore?: string;
    run?: string;
    reference?: string;
  };
  legacyRoutes: Array<{
    from: string;
    to: string;
    status: 301 | 308;
    preserveQuery: boolean;
  }>;
  fixturePath?: string;
  completePipelinePath?: string;
  expectedOutputPath?: string;
  explorerEvidence?: ExplorerEvidence;
  lastTechnicalVerification: string;
  lastEditorialVerification: string;
  claimIds: string[];
  status: ExampleStatus;
  replaces?: string[];
  retirementReason?: string;
}

export interface PublicCatalog {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  records: readonly ExampleRecord[];
}
