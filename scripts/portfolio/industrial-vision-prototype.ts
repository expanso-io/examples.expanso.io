#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const INDUSTRIAL_VISION_PROTOTYPE_ID =
  'industrial-vision-media-ai-spine-v1';
export const INDUSTRIAL_VISION_SEED =
  'industrial-vision-media-ai-spine-synthetic-v1';
export const INDUSTRIAL_VISION_SOURCE_PATH =
  'tests/prototypes/industrial-vision/source-v1.json';
export const INDUSTRIAL_VISION_CHECKPOINT_PATH =
  'tests/prototypes/industrial-vision/checkpoints-v1.json';

type ModelStatus = 'available' | 'unavailable';
type ScenarioKind = 'industrial-inspection' | 'utility-damage-reuse-proof';
type CheckpointKind =
  | 'local-retention'
  | 'selected-escalation'
  | 'failure-boundary';

export interface SelectedEvidence {
  id: string;
  mediaType: 'application/vnd.expanso.synthetic-evidence+json';
  contentDigest: `sha256:${string}`;
  bytes: number;
  syntheticDescriptor: string;
}

export interface VisionObservation {
  id: string;
  capturedAt: string;
  siteId: string;
  rawMedia: {
    localId: string;
    contentDigest: `sha256:${string}`;
    bytes: number;
    synthetic: true;
  };
  customModelEnvelope: {
    adapterId: 'custom-vision-model-adapter-v1';
    status: ModelStatus;
    label: 'normal' | 'candidate-defect' | null;
    score: number | null;
    failureCode: 'CUSTOM_MODEL_UNAVAILABLE' | null;
    selectedEvidence: SelectedEvidence | null;
  };
}

export interface VisionScenario {
  id: string;
  kind: ScenarioKind;
  reuseDemonstrationOnly: boolean;
  observations: VisionObservation[];
}

export interface IndustrialVisionSource {
  schemaVersion: '1.0.0';
  prototypeId: typeof INDUSTRIAL_VISION_PROTOTYPE_ID;
  deterministicSeed: typeof INDUSTRIAL_VISION_SEED;
  executionLabels: {
    architecture: 'deterministic-simulation';
    expansoPolicy: 'executed-policy-simulator';
    customModelOutput: 'curated-synthetic-envelope';
  };
  excludedClaims: string[];
  boundary: {
    expansoCentral: string[];
    adapter: string[];
    customModel: string[];
    externalSystem: string[];
  };
  policy: {
    escalateAtOrAbove: number;
    rawMediaEgressAllowed: false;
    emitModelFailures: true;
    cloudAllowlist: string[];
  };
  scenarios: VisionScenario[];
}

export interface CloudEvent {
  eventId: string;
  siteId: string;
  kind: 'selected-evidence' | 'model-boundary-failure';
  modelStatus: ModelStatus;
  label?: 'candidate-defect';
  score?: number;
  selectedEvidence?: SelectedEvidence;
  failureCode?: 'CUSTOM_MODEL_UNAVAILABLE';
}

export interface VisionCheckpoint {
  index: number;
  observationId: string;
  kind: CheckpointKind;
  state: {
    decision:
      | 'retain-raw-media-locally'
      | 'escalate-selected-evidence'
      | 'surface-custom-model-failure';
    rawMediaRetainedAtEdge: true;
    rawMediaBytesMoved: 0;
    cloudEvent: CloudEvent | null;
  };
  assertions: Array<{
    id: string;
    outcome: 'PASS';
  }>;
}

export interface VisionScenarioCheckpoints {
  scenarioId: string;
  checkpoints: VisionCheckpoint[];
  totals: {
    observations: number;
    rawMediaBytesObserved: number;
    rawMediaBytesMoved: 0;
    selectedEvidenceBytesMoved: number;
    selectedEscalations: number;
    modelBoundaryFailures: number;
  };
}

export interface IndustrialVisionCheckpointArtifact {
  schemaVersion: '1.0.0';
  prototypeId: typeof INDUSTRIAL_VISION_PROTOTYPE_ID;
  deterministicSeed: typeof INDUSTRIAL_VISION_SEED;
  scenarios: VisionScenarioCheckpoints[];
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function selectedEvidence(
  id: string,
  descriptor: string,
  bytes: number
): SelectedEvidence {
  return {
    id,
    mediaType: 'application/vnd.expanso.synthetic-evidence+json',
    contentDigest: sha256(`${INDUSTRIAL_VISION_SEED}:${id}:${descriptor}`),
    bytes,
    syntheticDescriptor: descriptor,
  };
}

function observation(
  scenarioId: string,
  input: {
    id: string;
    capturedAt: string;
    siteId: string;
    rawBytes: number;
    modelStatus: ModelStatus;
    label: VisionObservation['customModelEnvelope']['label'];
    score: number | null;
    failureCode: VisionObservation['customModelEnvelope']['failureCode'];
    evidence: SelectedEvidence | null;
  }
): VisionObservation {
  return {
    id: input.id,
    capturedAt: input.capturedAt,
    siteId: input.siteId,
    rawMedia: {
      localId: `synthetic-edge-media:${scenarioId}:${input.id}`,
      contentDigest: sha256(
        `${INDUSTRIAL_VISION_SEED}:${scenarioId}:${input.id}:raw-media`
      ),
      bytes: input.rawBytes,
      synthetic: true,
    },
    customModelEnvelope: {
      adapterId: 'custom-vision-model-adapter-v1',
      status: input.modelStatus,
      label: input.label,
      score: input.score,
      failureCode: input.failureCode,
      selectedEvidence: input.evidence,
    },
  };
}

export function buildIndustrialVisionSource(): IndustrialVisionSource {
  const inspectionId = 'industrial-line-inspection';
  const utilityId = 'utility-damage-reuse';
  return {
    schemaVersion: '1.0.0',
    prototypeId: INDUSTRIAL_VISION_PROTOTYPE_ID,
    deterministicSeed: INDUSTRIAL_VISION_SEED,
    executionLabels: {
      architecture: 'deterministic-simulation',
      expansoPolicy: 'executed-policy-simulator',
      customModelOutput: 'curated-synthetic-envelope',
    },
    excludedClaims: [
      'No camera, custom model, or Expanso binary was executed.',
      'The synthetic scores do not measure model accuracy.',
      'The prototype does not establish adoption, buying intent, or market priority.',
    ],
    boundary: {
      expansoCentral: [
        'consume the adapter envelope beside the media source',
        'apply deterministic local escalation policy',
        'strip raw-media fields from outbound events',
        'route selected evidence and boundary failures',
      ],
      adapter: [
        'translate camera and custom-model output into the declared envelope',
      ],
      customModel: [
        'run inference',
        'produce labels and scores',
        'extract selected evidence',
      ],
      externalSystem: [
        'capture raw media',
        'receive allowlisted events',
        'perform any control-loop action',
      ],
    },
    policy: {
      escalateAtOrAbove: 0.85,
      rawMediaEgressAllowed: false,
      emitModelFailures: true,
      cloudAllowlist: [
        'eventId',
        'siteId',
        'kind',
        'modelStatus',
        'label',
        'score',
        'selectedEvidence',
        'failureCode',
      ],
    },
    scenarios: [
      {
        id: inspectionId,
        kind: 'industrial-inspection',
        reuseDemonstrationOnly: false,
        observations: [
          observation(inspectionId, {
            id: 'line-frame-001',
            capturedAt: '2026-07-18T12:00:00.000Z',
            siteId: 'SYNTHETIC-LINE-A',
            rawBytes: 2_400_000,
            modelStatus: 'available',
            label: 'normal',
            score: 0.12,
            failureCode: null,
            evidence: null,
          }),
          observation(inspectionId, {
            id: 'line-frame-002',
            capturedAt: '2026-07-18T12:00:01.000Z',
            siteId: 'SYNTHETIC-LINE-A',
            rawBytes: 2_400_000,
            modelStatus: 'available',
            label: 'candidate-defect',
            score: 0.94,
            failureCode: null,
            evidence: selectedEvidence(
              'line-evidence-002',
              'synthetic seam region with candidate discontinuity',
              18_400
            ),
          }),
          observation(inspectionId, {
            id: 'line-frame-003',
            capturedAt: '2026-07-18T12:00:02.000Z',
            siteId: 'SYNTHETIC-LINE-A',
            rawBytes: 2_400_000,
            modelStatus: 'unavailable',
            label: null,
            score: null,
            failureCode: 'CUSTOM_MODEL_UNAVAILABLE',
            evidence: null,
          }),
        ],
      },
      {
        id: utilityId,
        kind: 'utility-damage-reuse-proof',
        reuseDemonstrationOnly: true,
        observations: [
          observation(utilityId, {
            id: 'utility-frame-001',
            capturedAt: '2026-07-18T12:10:00.000Z',
            siteId: 'SYNTHETIC-FEEDER-7',
            rawBytes: 3_200_000,
            modelStatus: 'available',
            label: 'candidate-defect',
            score: 0.91,
            failureCode: null,
            evidence: selectedEvidence(
              'utility-evidence-001',
              'synthetic pole-top region with candidate damage',
              22_100
            ),
          }),
          observation(utilityId, {
            id: 'utility-frame-002',
            capturedAt: '2026-07-18T12:10:01.000Z',
            siteId: 'SYNTHETIC-FEEDER-7',
            rawBytes: 3_200_000,
            modelStatus: 'available',
            label: 'normal',
            score: 0.22,
            failureCode: null,
            evidence: null,
          }),
        ],
      },
    ],
  };
}

function checkpointFor(
  source: IndustrialVisionSource,
  observation: VisionObservation,
  index: number
): VisionCheckpoint {
  const model = observation.customModelEnvelope;
  if (model.status === 'unavailable') {
    if (!source.policy.emitModelFailures || model.failureCode === null) {
      throw new Error(
        `Invalid model-boundary failure envelope: ${observation.id}`
      );
    }
    return {
      index,
      observationId: observation.id,
      kind: 'failure-boundary',
      state: {
        decision: 'surface-custom-model-failure',
        rawMediaRetainedAtEdge: true,
        rawMediaBytesMoved: 0,
        cloudEvent: {
          eventId: observation.id,
          siteId: observation.siteId,
          kind: 'model-boundary-failure',
          modelStatus: model.status,
          failureCode: model.failureCode,
        },
      },
      assertions: [
        { id: 'custom-model-boundary-visible', outcome: 'PASS' },
        { id: 'raw-media-remains-local', outcome: 'PASS' },
      ],
    };
  }

  if (
    model.label === 'candidate-defect' &&
    model.score !== null &&
    model.score >= source.policy.escalateAtOrAbove
  ) {
    if (model.selectedEvidence === null) {
      throw new Error(`Escalation lacks selected evidence: ${observation.id}`);
    }
    return {
      index,
      observationId: observation.id,
      kind: 'selected-escalation',
      state: {
        decision: 'escalate-selected-evidence',
        rawMediaRetainedAtEdge: true,
        rawMediaBytesMoved: 0,
        cloudEvent: {
          eventId: observation.id,
          siteId: observation.siteId,
          kind: 'selected-evidence',
          modelStatus: model.status,
          label: model.label,
          score: model.score,
          selectedEvidence: model.selectedEvidence,
        },
      },
      assertions: [
        { id: 'threshold-policy-applied', outcome: 'PASS' },
        { id: 'selected-evidence-allowlisted', outcome: 'PASS' },
        { id: 'raw-media-remains-local', outcome: 'PASS' },
      ],
    };
  }

  return {
    index,
    observationId: observation.id,
    kind: 'local-retention',
    state: {
      decision: 'retain-raw-media-locally',
      rawMediaRetainedAtEdge: true,
      rawMediaBytesMoved: 0,
      cloudEvent: null,
    },
    assertions: [
      { id: 'below-threshold-not-escalated', outcome: 'PASS' },
      { id: 'raw-media-remains-local', outcome: 'PASS' },
    ],
  };
}

export function runIndustrialVisionPrototype(
  source: IndustrialVisionSource
): IndustrialVisionCheckpointArtifact {
  if (
    source.schemaVersion !== '1.0.0' ||
    source.prototypeId !== INDUSTRIAL_VISION_PROTOTYPE_ID ||
    source.deterministicSeed !== INDUSTRIAL_VISION_SEED
  ) {
    throw new Error('Industrial-vision source header is invalid');
  }
  if (source.policy.rawMediaEgressAllowed !== false) {
    throw new Error('Raw-media egress must remain disabled');
  }
  if (source.scenarios.length < 2) {
    throw new Error('The Media-and-AI spine requires a reuse scenario');
  }
  if (!source.scenarios.some((scenario) => scenario.reuseDemonstrationOnly)) {
    throw new Error('The Media-and-AI spine has no bounded reuse proof');
  }

  const observationIds = new Set<string>();
  const scenarios = source.scenarios.map((scenario) => {
    if (scenario.observations.length === 0) {
      throw new Error(`Scenario has no observations: ${scenario.id}`);
    }
    const checkpoints = scenario.observations.map((entry, index) => {
      if (!entry.id || observationIds.has(entry.id)) {
        throw new Error(`Observation id is missing or duplicated: ${entry.id}`);
      }
      observationIds.add(entry.id);
      if (!Number.isInteger(entry.rawMedia.bytes) || entry.rawMedia.bytes < 1) {
        throw new Error(`Raw-media byte count is invalid: ${entry.id}`);
      }
      return checkpointFor(source, entry, index);
    });

    for (const checkpoint of checkpoints) {
      const serialized = JSON.stringify(checkpoint.state.cloudEvent);
      for (const forbidden of ['rawMedia', 'localId', 'capturedAt']) {
        if (serialized.includes(forbidden)) {
          throw new Error(
            `Cloud event leaks ${forbidden}: ${checkpoint.observationId}`
          );
        }
      }
      if (checkpoint.state.rawMediaBytesMoved !== 0) {
        throw new Error(
          `Raw media moved off edge: ${checkpoint.observationId}`
        );
      }
    }

    return {
      scenarioId: scenario.id,
      checkpoints,
      totals: {
        observations: scenario.observations.length,
        rawMediaBytesObserved: scenario.observations.reduce(
          (sum, entry) => sum + entry.rawMedia.bytes,
          0
        ),
        rawMediaBytesMoved: 0 as const,
        selectedEvidenceBytesMoved: scenario.observations.reduce(
          (sum, entry) =>
            sum + (entry.customModelEnvelope.selectedEvidence?.bytes ?? 0),
          0
        ),
        selectedEscalations: checkpoints.filter(
          (checkpoint) => checkpoint.kind === 'selected-escalation'
        ).length,
        modelBoundaryFailures: checkpoints.filter(
          (checkpoint) => checkpoint.kind === 'failure-boundary'
        ).length,
      },
    };
  });

  return {
    schemaVersion: '1.0.0',
    prototypeId: INDUSTRIAL_VISION_PROTOTYPE_ID,
    deterministicSeed: INDUSTRIAL_VISION_SEED,
    scenarios,
  };
}

function jsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function verifyOrWriteIndustrialVisionFixtures(write: boolean): void {
  const source = buildIndustrialVisionSource();
  const checkpoints = runIndustrialVisionPrototype(source);
  const outputs = new Map<string, string>([
    [INDUSTRIAL_VISION_SOURCE_PATH, jsonBytes(source)],
    [INDUSTRIAL_VISION_CHECKPOINT_PATH, jsonBytes(checkpoints)],
  ]);

  if (write) {
    for (const [path, bytes] of outputs) {
      writeFileSync(resolve(path), bytes);
    }
    process.stdout.write(
      `Wrote ${outputs.size} deterministic industrial-vision prototype artifacts.\n`
    );
    return;
  }

  const drift = [...outputs].filter(
    ([path, bytes]) => readFileSync(resolve(path), 'utf8') !== bytes
  );
  if (drift.length > 0) {
    throw new Error(
      `Industrial-vision prototype drift: ${drift.map(([path]) => path).join(', ')}`
    );
  }
  process.stdout.write(
    'Industrial-vision prototype is deterministic and byte-stable.\n'
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyOrWriteIndustrialVisionFixtures(
    process.argv.slice(2).includes('--write')
  );
}
