import checkpointJson from './disconnected-edge-checkpoints.json';
import evidenceJson from './disconnected-edge-evidence.json';
import sourceJson from './disconnected-edge-source.json';
import {
  validateCheckpointArtifact,
  validateRuntimeSource,
} from '../disconnectedEdgeMachine';
import type {
  RuntimeCheckpointArtifact,
  RuntimeProofEvidence,
  RuntimeSource,
} from '../types';

export const disconnectedEdgeSource = validateRuntimeSource(
  sourceJson as RuntimeSource
);

export const disconnectedEdgeCheckpoints = validateCheckpointArtifact(
  disconnectedEdgeSource,
  checkpointJson as RuntimeCheckpointArtifact
);

export const disconnectedEdgeEvidence = evidenceJson as RuntimeProofEvidence;

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const expectedPaths = {
  sourcePath:
    'src/components/ExplorerV2/runtime/proof/disconnected-edge-source.json',
  checkpointPath:
    'src/components/ExplorerV2/runtime/proof/disconnected-edge-checkpoints.json',
  stateMachinePath:
    'src/components/ExplorerV2/runtime/disconnectedEdgeMachine.ts',
} as const;

if (
  disconnectedEdgeEvidence.schemaVersion !== '1.0.0' ||
  disconnectedEdgeEvidence.kind !== 'deterministic-simulation' ||
  disconnectedEdgeEvidence.exampleId !== disconnectedEdgeSource.exampleId ||
  disconnectedEdgeEvidence.sourcePath !== expectedPaths.sourcePath ||
  disconnectedEdgeEvidence.checkpointPath !== expectedPaths.checkpointPath ||
  disconnectedEdgeEvidence.stateMachinePath !==
    expectedPaths.stateMachinePath ||
  !digestPattern.test(disconnectedEdgeEvidence.sourceSha256) ||
  !digestPattern.test(disconnectedEdgeEvidence.checkpointSha256) ||
  !digestPattern.test(disconnectedEdgeEvidence.stateMachineSha256) ||
  !disconnectedEdgeEvidence.verificationId ||
  !disconnectedEdgeEvidence.command ||
  !disconnectedEdgeEvidence.environment ||
  !disconnectedEdgeEvidence.generatedAt ||
  !disconnectedEdgeEvidence.verifierAgentId ||
  !disconnectedEdgeEvidence.toolVersions ||
  Object.values(disconnectedEdgeEvidence.toolVersions).some(
    (version) => !version
  ) ||
  !Array.isArray(disconnectedEdgeEvidence.excludedClaims) ||
  disconnectedEdgeEvidence.excludedClaims.length === 0 ||
  !Array.isArray(disconnectedEdgeEvidence.modeledBehaviors) ||
  disconnectedEdgeEvidence.modeledBehaviors.join('\n') !==
    disconnectedEdgeSource.modeledBehaviors.join('\n')
) {
  throw new Error('Disconnected-edge runtime proof evidence is inconsistent');
}
