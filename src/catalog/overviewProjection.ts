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

export function getCatalogOverviewProjection(
  exampleId: string
): CatalogOverviewProjection {
  const record = EXAMPLE_RECORD_BY_ID.get(exampleId);
  if (!record) {
    throw new Error(`Unknown public example id: ${exampleId}`);
  }

  return {
    header: {
      title: record.title,
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
