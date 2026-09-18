import {
  CATALOG_SCHEMA_VERSION,
  REMOVE_PII_EXPLORER_EVIDENCE,
  VERIFICATION_POLICY_DIGEST,
  type ComponentId,
  type DataClassification,
  type ExampleRecord,
  type LocationFacetId,
  type PublicCatalog,
  type TopologyNode,
  type TopologyNodeKind,
} from './schema';
import { GENERATED_ARCHITECTURE_EXPLORER_EVIDENCE } from './explorerEvidence.generated';

const REVIEW_DATE = '2026-07-18';
const INSPECT_ASSUMPTIONS =
  'Repository is available locally; excludes downloads and external-service provisioning.';

type Endpoint = {
  id: string;
  label: string;
  kind: TopologyNodeKind;
  location: LocationFacetId;
  componentId?: ComponentId;
  requiredForCorePath: boolean;
};

function topology(
  source: Endpoint,
  runtimeLocation: LocationFacetId,
  destinations: readonly Endpoint[],
  payload: string,
  dataClassification: DataClassification
) {
  const runtime: TopologyNode = {
    id: 'expanso',
    label: 'Expanso pipeline',
    kind: 'expanso-native',
    location: runtimeLocation,
    componentId: 'expanso-runtime',
    requiredForCorePath: true,
  };

  return {
    nodes: [source, runtime, ...destinations],
    flows: [
      {
        from: source.id,
        to: runtime.id,
        payload,
        dataClassification,
        crossesBoundary: source.location !== runtime.location,
      },
      ...destinations.map((destination) => ({
        from: runtime.id,
        to: destination.id,
        payload,
        dataClassification,
        crossesBoundary: runtime.location !== destination.location,
      })),
    ],
  };
}

const localInput: Endpoint = {
  id: 'input',
  label: 'Local input',
  kind: 'external',
  location: 'on-premises',
  componentId: 'local-file',
  requiredForCorePath: true,
};

const localOutput: Endpoint = {
  id: 'output',
  label: 'Local output',
  kind: 'external',
  location: 'on-premises',
  componentId: 'standard-output',
  requiredForCorePath: true,
};

const authoredRecords = [
  {
    id: 'circuit-breakers',
    producerLane: 'engineering',
    verifierLane: 'adversarial-verifier',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Circuit Breaker Patterns',
    oneLineOutcome:
      'Route around a failing downstream system without cascading the failure.',
    primaryGoal: 'operate-resiliently',
    goals: ['operate-resiliently', 'route-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [
        {
          id: 'service',
          label: 'Downstream service',
          kind: 'external',
          location: 'edge-to-cloud',
          componentId: 'http-service',
          requiredForCorePath: true,
        },
      ],
      'request events',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 4,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/data-routing/circuit-breakers/',
      explore: '/data-routing/circuit-breakers/explorer/',
      reference: '/data-routing/circuit-breakers/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-routing/circuit-breakers.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'content-routing',
    producerLane: 'engineering',
    verifierLane: 'accessibility',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Content-Based Routing',
    oneLineOutcome:
      'Route records by severity, region, event type, and priority.',
    primaryGoal: 'route-data',
    goals: ['route-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'classified events',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 3,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-routing/content-routing/',
      explore: '/data-routing/content-routing/explorer/',
      reference: '/data-routing/content-routing/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-routing/content-routing.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'content-splitting',
    producerLane: 'engineering',
    verifierLane: 'product-semantics',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Content-Based Splitting',
    oneLineOutcome:
      'Split compound messages into independently processable records.',
    primaryGoal: 'transform-data',
    goals: ['transform-data', 'route-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'split records',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 3,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-routing/content-splitting/',
      explore: '/data-routing/content-splitting/explorer/',
      reference: '/data-routing/content-splitting/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-routing/content-splitting.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'fan-out-pattern',
    producerLane: 'engineering',
    verifierLane: 'product-semantics',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Fan-Out Pattern',
    oneLineOutcome:
      'Send each record to multiple destinations with independent delivery paths.',
    primaryGoal: 'route-data',
    goals: ['route-data', 'operate-resiliently'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [
        {
          id: 'kafka',
          label: 'Kafka',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'kafka',
          requiredForCorePath: true,
        },
        {
          id: 's3',
          label: 'Amazon S3',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'amazon-s3',
          requiredForCorePath: true,
        },
        {
          id: 'search',
          label: 'Elasticsearch',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'elasticsearch',
          requiredForCorePath: true,
        },
      ],
      'routed events',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 5,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/data-routing/fan-out-pattern/',
      explore: '/data-routing/fan-out-pattern/explorer/',
      reference: '/data-routing/fan-out-pattern/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-routing/fan-out-pattern.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'priority-queues',
    producerLane: 'product-semantics',
    verifierLane: 'engineering',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Priority Queues',
    oneLineOutcome:
      'Classify and route messages into priority-specific queues.',
    primaryGoal: 'route-data',
    goals: ['route-data', 'operate-resiliently'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'priority-scored events',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 4,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-routing/priority-queues/',
      explore: '/data-routing/priority-queues/explorer/',
      reference: '/data-routing/priority-queues/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-routing/priority-queues.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'smart-buffering',
    producerLane: 'engineering',
    verifierLane: 'adversarial-verifier',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Smart Buffering',
    oneLineOutcome:
      'Deliver higher-priority messages first while a backlog drains.',
    primaryGoal: 'operate-resiliently',
    goals: ['operate-resiliently', 'route-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'buffered events',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 4,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/data-routing/smart-buffering/',
      explore: '/data-routing/smart-buffering/explorer/',
      reference: '/data-routing/smart-buffering/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'examples/data-routing/smart-buffering.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'cross-border-gdpr',
    producerLane: 'claims-evidence',
    verifierLane: 'dataset-privacy',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Cross-Border GDPR',
    oneLineOutcome:
      'Minimize and pseudonymize synthetic records before an analytics transfer.',
    primaryGoal: 'secure-data',
    goals: ['secure-data', 'transform-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [
        {
          id: 'analytics',
          label: 'Analytics destination',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'analytics-destination',
          requiredForCorePath: false,
        },
      ],
      'minimized synthetic records',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 5,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-security/cross-border-gdpr/',
      reference: '/data-security/cross-border-gdpr/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath:
      'examples/data-security/cross-border-gdpr/cross-border-gdpr.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'encrypt-data',
    producerLane: 'engineering',
    verifierLane: 'claims-evidence',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Encrypt Sensitive Data',
    oneLineOutcome:
      'Encrypt selected fields while retaining explicitly non-sensitive fields for analysis.',
    primaryGoal: 'secure-data',
    goals: ['secure-data', 'transform-data'],
    industries: ['cross-industry', 'financial-services'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'encrypted synthetic records',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 4,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-security/encrypt-data/',
      explore: '/data-security/encrypt-data/explorer/',
      reference: '/data-security/encrypt-data/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-security/encrypt-data.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'encryption-patterns',
    producerLane: 'product-semantics',
    verifierLane: 'engineering',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Encryption Patterns',
    oneLineOutcome:
      'Compare field-level encryption patterns across common synthetic record shapes.',
    primaryGoal: 'secure-data',
    goals: ['secure-data'],
    industries: ['cross-industry', 'financial-services'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'encrypted synthetic records',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 5,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-security/encryption-patterns/',
      explore: '/data-security/encryption-patterns/explorer/',
      reference: '/data-security/encryption-patterns/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-security/encryption-patterns.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'enforce-schema',
    producerLane: 'engineering',
    verifierLane: 'product-semantics',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Enforce Schema',
    oneLineOutcome:
      'Validate JSON records and route rejected data to a dead-letter path.',
    primaryGoal: 'secure-data',
    goals: ['secure-data', 'transform-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'validated synthetic records',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 3,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-security/enforce-schema/',
      explore: '/data-security/enforce-schema/explorer/',
      reference: '/data-security/enforce-schema/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/files/data-security/enforce-schema.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'remove-pii',
    producerLane: 'engineering',
    verifierLane: 'accessibility',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Remove PII',
    oneLineOutcome:
      'Delete, hash, pseudonymize, and generalize selected fields in synthetic records.',
    primaryGoal: 'secure-data',
    goals: ['secure-data', 'transform-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'de-identified synthetic records',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 3,
      runMinutes: 2,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'offline-runnable',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    explorerEvidence: REMOVE_PII_EXPLORER_EVIDENCE,
    routes: {
      overview: '/data-security/remove-pii/',
      explore: '/data-security/remove-pii/explorer/',
      run: '/data-security/remove-pii/setup/',
      reference: '/data-security/remove-pii/troubleshooting/',
    },
    legacyRoutes: [],
    fixturePath: 'examples/data-security/remove-pii/sample-data.json',
    completePipelinePath: 'examples/data-security/remove-pii-complete.yaml',
    expectedOutputPath:
      'examples/data-security/remove-pii/expected-output.jsonl',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'aggregate-time-windows',
    producerLane: 'engineering',
    verifierLane: 'design',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Aggregate Time Windows',
    oneLineOutcome:
      'Calculate counts and summary statistics across event-time windows.',
    primaryGoal: 'transform-data',
    goals: ['transform-data', 'analyze-edge-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'windowed aggregates',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 4,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-transformation/aggregate-time-windows/',
      explore: '/data-transformation/aggregate-time-windows/explorer/',
      reference: '/data-transformation/aggregate-time-windows/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath:
      'static/files/data-transformation/aggregate-time-windows.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'deduplicate-events',
    producerLane: 'engineering',
    verifierLane: 'product-semantics',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Deduplicate Events',
    oneLineOutcome:
      'Drop repeated events using exact, fingerprint, and identifier-based matching.',
    primaryGoal: 'transform-data',
    goals: ['transform-data', 'operate-resiliently'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'deduplicated events',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 4,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-transformation/deduplicate-events/',
      explore: '/data-transformation/deduplicate-events/explorer/',
      reference: '/data-transformation/deduplicate-events/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath:
      'static/files/data-transformation/deduplicate-events.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'normalize-timestamps',
    producerLane: 'engineering',
    verifierLane: 'editorial',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Normalize Timestamps',
    oneLineOutcome:
      'Parse multiple timestamp representations into a consistent UTC form.',
    primaryGoal: 'transform-data',
    goals: ['transform-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'normalized events',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 3,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-transformation/normalize-timestamps/',
      explore: '/data-transformation/normalize-timestamps/explorer/',
      reference: '/data-transformation/normalize-timestamps/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath:
      'static/files/data-transformation/normalize-timestamps.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'parse-logs',
    producerLane: 'engineering',
    verifierLane: 'editorial',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Parse Structured Logs',
    oneLineOutcome:
      'Turn JSON, CSV, syslog, and access logs into structured records.',
    primaryGoal: 'transform-data',
    goals: ['transform-data', 'process-logs'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'structured logs',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 3,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-transformation/parse-logs/',
      explore: '/data-transformation/parse-logs/explorer/',
      reference: '/data-transformation/parse-logs/troubleshooting/',
    },
    legacyRoutes: [],
    fixturePath: 'examples/data-transformation/input.jsonl',
    completePipelinePath: 'static/files/data-transformation/parse-logs.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'transform-formats',
    producerLane: 'engineering',
    verifierLane: 'product-semantics',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Transform Formats',
    oneLineOutcome:
      'Convert records between JSON, Avro, and Parquet representations.',
    primaryGoal: 'transform-data',
    goals: ['transform-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'encoded records',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 4,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/data-transformation/transform-formats/',
      explore: '/data-transformation/transform-formats/explorer/',
      reference: '/data-transformation/transform-formats/troubleshooting/',
    },
    legacyRoutes: [],
    fixturePath: 'examples/data-transformation/input.json',
    completePipelinePath:
      'static/files/data-transformation/transform-formats.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'db2-to-bigquery',
    producerLane: 'claims-evidence',
    verifierLane: 'editorial',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'DB2 to BigQuery',
    oneLineOutcome:
      'Map a representative DB2 export into a BigQuery-oriented schema.',
    primaryGoal: 'migrate-data',
    goals: ['migrate-data', 'transform-data'],
    industries: ['financial-services'],
    topology: topology(
      {
        id: 'db2',
        label: 'IBM Db2 export',
        kind: 'external',
        location: 'on-premises',
        componentId: 'db2',
        requiredForCorePath: true,
      },
      'on-premises',
      [
        {
          id: 'bigquery',
          label: 'BigQuery',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'google-bigquery',
          requiredForCorePath: true,
        },
      ],
      'mapped transaction records',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 6,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/enterprise-migration/db2-to-bigquery/',
      reference: '/enterprise-migration/db2-to-bigquery/troubleshooting/',
    },
    legacyRoutes: [],
    fixturePath:
      'examples/enterprise-migration/db2-to-bigquery/sample-input.json',
    completePipelinePath:
      'examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'nightly-backup',
    producerLane: 'product-semantics',
    verifierLane: 'editorial',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Nightly Backup',
    oneLineOutcome:
      'Extract database records, add recovery metadata, and route backup objects to storage.',
    primaryGoal: 'migrate-data',
    goals: ['migrate-data', 'operate-resiliently'],
    industries: ['cross-industry'],
    topology: topology(
      {
        id: 'database',
        label: 'PostgreSQL',
        kind: 'external',
        location: 'on-premises',
        componentId: 'postgresql',
        requiredForCorePath: true,
      },
      'on-premises',
      [
        {
          id: 'storage',
          label: 'Cloud object storage',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'amazon-s3',
          requiredForCorePath: true,
        },
      ],
      'backup records',
      'operational'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 6,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/enterprise-migration/nightly-backup/',
      reference: '/enterprise-migration/nightly-backup/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath:
      'examples/enterprise-migration/nightly-backup/nightly-backup.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'medical-device-intelligence',
    producerLane: 'claims-evidence',
    verifierLane: 'accessibility',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Medical Device Intelligence',
    oneLineOutcome:
      'Batch synthetic field reports locally and send a bounded summary to fleet systems.',
    primaryGoal: 'analyze-edge-data',
    goals: ['analyze-edge-data', 'secure-data'],
    industries: ['healthcare'],
    topology: topology(
      {
        id: 'reports',
        label: 'Synthetic device reports',
        kind: 'external',
        location: 'remote-site',
        componentId: 'local-file',
        requiredForCorePath: true,
      },
      'remote-site',
      [
        {
          id: 'model',
          label: 'Claude API',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'anthropic-claude',
          requiredForCorePath: true,
        },
        {
          id: 'fleet',
          label: 'Fleet management',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'fleet-management',
          requiredForCorePath: true,
        },
      ],
      'field-report summaries',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: { inspectMinutes: 7, assumptions: INSPECT_ASSUMPTIONS },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: { overview: '/integrations/medical-device-intelligence/' },
    legacyRoutes: [],
    fixturePath:
      'examples/integrations/medical-device-intelligence/error-events.json',
    completePipelinePath:
      'docs/integrations/medical-device-intelligence/pipeline.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'motherduck-retail-analytics',
    producerLane: 'editorial',
    verifierLane: 'engineering',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'MotherDuck Retail Analytics',
    oneLineOutcome:
      'Prepare synthetic point-of-sale events as partitioned Parquet for cloud analytics.',
    primaryGoal: 'analyze-edge-data',
    goals: ['analyze-edge-data', 'transform-data'],
    industries: ['retail'],
    topology: topology(
      {
        id: 'pos',
        label: 'Synthetic POS events',
        kind: 'external',
        location: 'remote-site',
        componentId: 'synthetic-generator',
        requiredForCorePath: true,
      },
      'remote-site',
      [
        {
          id: 'storage',
          label: 'Amazon S3',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'amazon-s3',
          requiredForCorePath: true,
        },
        {
          id: 'warehouse',
          label: 'MotherDuck',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'motherduck',
          requiredForCorePath: true,
        },
      ],
      'partitioned retail events',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 6,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/integrations/motherduck-retail-analytics/',
    },
    legacyRoutes: [],
    completePipelinePath: 'static/pipelines/motherduck-retail-pipeline.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'oran-telco-pipeline',
    producerLane: 'engineering',
    verifierLane: 'claims-evidence',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'O-RAN Telemetry',
    oneLineOutcome:
      'Normalize synthetic radio telemetry and route selected metrics to example destinations.',
    primaryGoal: 'analyze-edge-data',
    goals: ['analyze-edge-data', 'route-data'],
    industries: ['telecommunications'],
    topology: topology(
      {
        id: 'radio',
        label: 'Synthetic O-RAN telemetry',
        kind: 'external',
        location: 'remote-site',
        componentId: 'local-file',
        requiredForCorePath: true,
      },
      'remote-site',
      [
        {
          id: 'kafka',
          label: 'Kafka',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'kafka',
          requiredForCorePath: true,
        },
        {
          id: 'grafana',
          label: 'Grafana',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'grafana',
          requiredForCorePath: false,
        },
      ],
      'telemetry metrics',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 6,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/integrations/oran-telco-pipeline/',
      explore: '/integrations/oran-telco-pipeline/explorer/',
    },
    legacyRoutes: [],
    fixturePath: 'examples/integrations/oran-input.yaml',
    completePipelinePath: 'static/pipelines/oran-telco-pipeline.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'scada-energy-edge',
    producerLane: 'product-semantics',
    verifierLane: 'claims-evidence',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'SCADA Energy Edge',
    oneLineOutcome:
      'Transform adapter-decoded synthetic SCADA telemetry and route selected events.',
    primaryGoal: 'analyze-edge-data',
    goals: ['analyze-edge-data', 'route-data'],
    industries: ['energy-utilities'],
    topology: topology(
      {
        id: 'gateway',
        label: 'SCADA gateway',
        kind: 'protocol-adapter',
        location: 'remote-site',
        componentId: 'scada-gateway',
        requiredForCorePath: true,
      },
      'remote-site',
      [
        {
          id: 'kafka',
          label: 'Kafka',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'kafka',
          requiredForCorePath: true,
        },
        {
          id: 'archive',
          label: 'Local archive',
          kind: 'external',
          location: 'remote-site',
          componentId: 'local-file',
          requiredForCorePath: false,
        },
      ],
      'decoded telemetry',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 6,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/integrations/scada-energy-edge/',
      explore: '/integrations/scada-energy-edge/explorer/',
      reference: '/integrations/scada-energy-edge/troubleshooting/',
    },
    legacyRoutes: [],
    fixturePath: 'examples/integrations/scada-energy-edge/input.txt',
    completePipelinePath:
      'examples/integrations/scada-energy-edge/scada-edge-complete.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'splunk-edge-processing',
    producerLane: 'claims-evidence',
    verifierLane: 'editorial',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Splunk Edge Processing',
    oneLineOutcome:
      'Prepare, filter, and route synthetic edge events to a Splunk HEC boundary.',
    primaryGoal: 'process-logs',
    goals: ['process-logs', 'route-data'],
    industries: ['cross-industry'],
    topology: topology(
      {
        id: 'logs',
        label: 'Synthetic edge logs',
        kind: 'external',
        location: 'remote-site',
        componentId: 'local-file',
        requiredForCorePath: true,
      },
      'remote-site',
      [
        {
          id: 'splunk',
          label: 'Splunk HEC',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'splunk-hec',
          requiredForCorePath: true,
        },
      ],
      'filtered log events',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 6,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/integrations/splunk-edge-processing/',
      explore: '/integrations/splunk-edge-processing/explorer/',
    },
    legacyRoutes: [],
    fixturePath: 'examples/integrations/splunk-input.yaml',
    completePipelinePath: 'static/pipelines/splunk-production-pipeline.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'enrich-export',
    producerLane: 'editorial',
    verifierLane: 'engineering',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Enrich and Export',
    oneLineOutcome:
      'Add lineage metadata, batch logs, and export the result to object storage.',
    primaryGoal: 'process-logs',
    goals: ['process-logs', 'analyze-edge-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [
        {
          id: 'storage',
          label: 'Amazon S3',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'amazon-s3',
          requiredForCorePath: true,
        },
      ],
      'enriched logs',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 5,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/log-processing/enrich-export/',
      explore: '/log-processing/enrich-export/explorer/',
      reference: '/log-processing/enrich-export/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath: 'examples/log-processing/enrich-export-complete.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'filter-severity',
    producerLane: 'engineering',
    verifierLane: 'product-semantics',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Filter Severity',
    oneLineOutcome:
      'Keep higher-severity log events and route them to local outputs.',
    primaryGoal: 'process-logs',
    goals: ['process-logs', 'route-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [localOutput],
      'filtered logs',
      'synthetic'
    ),
    difficulty: 'intermediate',
    expectedTime: {
      inspectMinutes: 3,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'transform',
    routes: {
      overview: '/log-processing/filter-severity/',
      explore: '/log-processing/filter-severity/explorer/',
      reference: '/log-processing/filter-severity/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath:
      'examples/log-processing/filter-severity-complete.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
  {
    id: 'production-pipeline',
    producerLane: 'product-semantics',
    verifierLane: 'engineering',
    verificationPolicyDigest: VERIFICATION_POLICY_DIGEST,
    title: 'Production Pipeline',
    oneLineOutcome:
      'Parse, enrich, reduce, redact, and fan out synthetic logs in one pipeline.',
    primaryGoal: 'process-logs',
    goals: ['process-logs', 'secure-data', 'route-data'],
    industries: ['cross-industry'],
    topology: topology(
      localInput,
      'on-premises',
      [
        {
          id: 'kafka',
          label: 'Kafka',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'kafka',
          requiredForCorePath: true,
        },
        {
          id: 'storage',
          label: 'Amazon S3',
          kind: 'external',
          location: 'cloud-account',
          componentId: 'amazon-s3',
          requiredForCorePath: true,
        },
      ],
      'processed logs',
      'synthetic'
    ),
    difficulty: 'advanced',
    expectedTime: {
      inspectMinutes: 6,
      assumptions: INSPECT_ASSUMPTIONS,
    },
    executionStatus: 'architecture-only',
    operationalEvidence: 'not-assessed',
    interaction: 'architecture',
    routes: {
      overview: '/log-processing/production-pipeline/',
      explore: '/log-processing/production-pipeline/explorer/',
      reference: '/log-processing/production-pipeline/troubleshooting/',
    },
    legacyRoutes: [],
    completePipelinePath:
      'examples/log-processing/production-pipeline-complete.yaml',
    lastTechnicalVerification: REVIEW_DATE,
    lastEditorialVerification: REVIEW_DATE,
    claimIds: [],
    status: 'published',
  },
] satisfies ExampleRecord[];

function bindExplorerEvidence(record: ExampleRecord): ExampleRecord {
  if (!record.routes.explore) return record;
  if (record.explorerEvidence) return record;
  const explorerEvidence = GENERATED_ARCHITECTURE_EXPLORER_EVIDENCE[record.id];
  if (!explorerEvidence) {
    throw new Error(
      `Published Explorer has no generated provenance evidence: ${record.id}`
    );
  }
  return { ...record, explorerEvidence };
}

const records: ExampleRecord[] = authoredRecords.map(bindExplorerEvidence);

export const PUBLIC_CATALOG: PublicCatalog = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  records,
};

export const EXAMPLE_RECORDS: readonly ExampleRecord[] = PUBLIC_CATALOG.records;

export const EXAMPLE_RECORD_BY_ID: ReadonlyMap<string, ExampleRecord> = new Map(
  EXAMPLE_RECORDS.map((record) => [record.id, record])
);
