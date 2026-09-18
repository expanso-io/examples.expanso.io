import { EXAMPLE_RECORD_BY_ID } from './registry';
import type {
  ExecutionStatus,
  ExplorerProvenanceKind,
  OperationalEvidence,
} from './schema';

export interface CatalogExplorerBinding {
  exampleId: string;
  canonicalPipelinePath: string;
  provenance: ExplorerProvenanceKind;
  executionStatus: ExecutionStatus;
  operationalEvidence: OperationalEvidence;
  fixtureLabel: string;
  comparisonMode: 'diff' | 'highlights';
}

function fileLabel(path: string): string {
  return path.split('/').at(-1) ?? path;
}

/**
 * Resolve the public Explorer identity from the typed catalog.
 *
 * Every Explorer carries explicit evidence. Architecture-only Explorers bind
 * authored checkpoints as curated explanations; the adapter never invents an
 * identity, sample, or provenance level.
 */
export function resolveCatalogExplorerBinding(
  exampleId: string
): CatalogExplorerBinding {
  const record = EXAMPLE_RECORD_BY_ID.get(exampleId);
  if (!record) {
    throw new Error(`Explorer catalog record does not exist: ${exampleId}`);
  }
  if (!record.routes.explore) {
    throw new Error(
      `Catalog record does not publish an Explorer: ${exampleId}`
    );
  }
  if (!record.completePipelinePath) {
    throw new Error(`Catalog Explorer has no canonical pipeline: ${exampleId}`);
  }

  const evidence = record.explorerEvidence;
  if (!evidence) {
    throw new Error(
      `Catalog Explorer has no bound provenance evidence: ${exampleId}`
    );
  }

  return {
    exampleId: record.id,
    canonicalPipelinePath: record.completePipelinePath,
    provenance: evidence.kind,
    executionStatus: record.executionStatus,
    operationalEvidence: record.operationalEvidence,
    fixtureLabel: fileLabel(evidence.inputCheckpointPath),
    comparisonMode:
      evidence.kind === 'curated-explanation' &&
      record.executionStatus === 'architecture-only'
        ? 'highlights'
        : 'diff',
  };
}
