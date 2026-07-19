import { EXAMPLE_RECORD_BY_ID } from './registry';
import {
  LOCATION_FACETS,
  type Difficulty,
  type ExecutionStatus,
  type OperationalEvidence,
  type TopologyNodeKind,
} from './schema';

export interface CatalogHeaderProjection {
  difficulty: Difficulty;
  executionStatus: ExecutionStatus;
  expectedTime: {
    inspectMinutes: number;
    runMinutes?: number;
  };
  operationalEvidence: OperationalEvidence;
  outcome: string;
  problem: string;
  title: string;
  verifiedAt: string;
}

export interface CatalogBoundaryNodeProjection {
  id: string;
  kind: TopologyNodeKind;
  label: string;
  location: string;
}

export interface CatalogBoundaryFlowProjection {
  crossesBoundary: boolean;
  from: string;
  payload: string;
  to: string;
}

export interface CatalogBoundaryProjection {
  flows: readonly CatalogBoundaryFlowProjection[];
  nodes: readonly CatalogBoundaryNodeProjection[];
}

export interface CatalogOverviewProjection {
  boundary: CatalogBoundaryProjection;
  header: CatalogHeaderProjection;
}

const locationLabelById = new Map(
  LOCATION_FACETS.map((location) => [location.id, location.label])
);

const customerProblemByExampleId: Readonly<Record<string, string>> = {
  'circuit-breakers':
    'A failing downstream service can stall a pipeline and cascade the failure into every record behind it.',
  'content-routing':
    'Different records need different destinations, but duplicating pipelines for every routing rule creates brittle operations.',
  'content-splitting':
    'Large compound messages are difficult to process, retry, and route as independent business events.',
  'fan-out-pattern':
    'The same record often needs to reach several systems without coupling every destination into one delivery path.',
  'priority-queues':
    'Urgent records can get trapped behind routine traffic when every message follows the same queue.',
  'smart-buffering':
    'During a backlog, high-priority messages wait behind older, lower-value work.',
  'cross-border-gdpr':
    'Analytics teams need useful records without transferring every sensitive source field across regions.',
  'encrypt-data':
    'Sensitive fields need protection while the rest of each record remains available for processing and analysis.',
  'encryption-patterns':
    'Teams need a repeatable way to protect sensitive fields across records with different shapes.',
  'enforce-schema':
    'Malformed records can contaminate downstream systems when shape validation happens too late.',
  'remove-pii':
    'Raw event streams often contain more personal data than downstream analytics actually needs.',
  'aggregate-time-windows':
    'High-volume event streams are expensive to analyze record by record when consumers only need periodic summaries.',
  'deduplicate-events':
    'Retries and repeated source events can inflate counts and trigger the same downstream action more than once.',
  'normalize-timestamps':
    'Mixed timestamp formats and time zones make records difficult to order, join, and analyze reliably.',
  'parse-logs':
    'Operational logs arrive in incompatible text formats that downstream tools cannot query consistently.',
  'transform-formats':
    'Producers and consumers often require different serialization formats, creating conversion work at every integration boundary.',
  'db2-to-bigquery':
    'Legacy DB2 records do not match the schema and field conventions expected by cloud analytics systems.',
  'nightly-backup':
    'Database backups need consistent recovery metadata and routing before they can be trusted as restore inputs.',
  'medical-device-intelligence':
    'Field reports are fragmented across devices and sites, making fleet-level issues hard to identify without moving raw data centrally.',
  'motherduck-retail-analytics':
    'Point-of-sale events need an analytics-ready shape before stores can send efficient batches to cloud systems.',
  'oran-telco-pipeline':
    'Radio telemetry arrives with inconsistent fields and more detail than each operations destination needs.',
  'scada-energy-edge':
    'Industrial telemetry needs to be normalized and classified near the equipment before selected events leave the site.',
  'splunk-edge-processing':
    'Sending every raw edge event to Splunk increases ingestion volume and delays useful normalization until after transfer.',
  'enrich-export':
    'Raw logs lack the lineage and batch structure needed for reliable object-storage analytics.',
  'filter-severity':
    'Low-value log traffic can overwhelm downstream storage and obscure the events operators need first.',
  'production-pipeline':
    'Production logs need several coordinated transformations before they are safe and useful across multiple destinations.',
};

export function getCatalogOverviewProjection(
  exampleId: string
): CatalogOverviewProjection {
  const record = EXAMPLE_RECORD_BY_ID.get(exampleId);
  if (!record) {
    throw new Error(`Unknown public example id: ${exampleId}`);
  }
  const problem = customerProblemByExampleId[exampleId];
  if (!problem) {
    throw new Error(`Public example has no customer problem: ${exampleId}`);
  }

  return {
    header: {
      title: record.title,
      problem,
      outcome: record.oneLineOutcome,
      difficulty: record.difficulty,
      executionStatus: record.executionStatus,
      operationalEvidence: record.operationalEvidence,
      expectedTime: {
        inspectMinutes: record.expectedTime.inspectMinutes,
        ...(record.expectedTime.runMinutes === undefined
          ? {}
          : { runMinutes: record.expectedTime.runMinutes }),
      },
      verifiedAt: record.lastTechnicalVerification,
    },
    boundary: {
      nodes: record.topology.nodes.map(({ id, kind, label, location }) => ({
        id,
        kind,
        label,
        location: locationLabelById.get(location) ?? location,
      })),
      flows: record.topology.flows.map(
        ({ crossesBoundary, from, payload, to }) => ({
          crossesBoundary,
          from,
          payload,
          to,
        })
      ),
    },
  };
}
