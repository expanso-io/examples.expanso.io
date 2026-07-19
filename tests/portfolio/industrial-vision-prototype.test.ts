import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';

import {
  INDUSTRIAL_VISION_CHECKPOINT_PATH,
  INDUSTRIAL_VISION_SEED,
  INDUSTRIAL_VISION_SOURCE_PATH,
  runIndustrialVisionPrototype,
  verifyOrWriteIndustrialVisionFixtures,
  type IndustrialVisionCheckpointArtifact,
  type IndustrialVisionSource,
} from '../../scripts/portfolio/industrial-vision-prototype';

const DATA_RIGHTS_PATH =
  'tests/prototypes/industrial-vision/data-rights-v1.json';
const DATASET_POLICY_PATH = 'content/contracts/dataset-policy-v1.json';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

function digest(path: string): string {
  return `sha256:${createHash('sha256')
    .update(readFileSync(resolve(path)))
    .digest('hex')}`;
}

describe('Industrial Vision Media-and-AI test-only prototype', () => {
  it('replays byte-stable fixtures from the pinned deterministic seed', () => {
    verifyOrWriteIndustrialVisionFixtures(false);
    const source = readJson<IndustrialVisionSource>(
      INDUSTRIAL_VISION_SOURCE_PATH
    );
    const expected = readJson<IndustrialVisionCheckpointArtifact>(
      INDUSTRIAL_VISION_CHECKPOINT_PATH
    );

    assert.equal(source.deterministicSeed, INDUSTRIAL_VISION_SEED);
    assert.deepEqual(runIndustrialVisionPrototype(source), expected);
    assert.deepEqual(
      runIndustrialVisionPrototype(source),
      runIndustrialVisionPrototype(source)
    );
  });

  it('keeps raw media local and emits only selected evidence or a boundary failure', () => {
    const source = readJson<IndustrialVisionSource>(
      INDUSTRIAL_VISION_SOURCE_PATH
    );
    const artifact = runIndustrialVisionPrototype(source);
    const checkpoints = artifact.scenarios.flatMap(
      (scenario) => scenario.checkpoints
    );

    assert.equal(source.policy.rawMediaEgressAllowed, false);
    assert.ok(
      checkpoints.some(
        (checkpoint) => checkpoint.kind === 'selected-escalation'
      )
    );
    assert.ok(
      checkpoints.some((checkpoint) => checkpoint.kind === 'failure-boundary')
    );
    assert.ok(
      checkpoints.some((checkpoint) => checkpoint.kind === 'local-retention')
    );
    for (const checkpoint of checkpoints) {
      assert.equal(checkpoint.state.rawMediaRetainedAtEdge, true);
      assert.equal(checkpoint.state.rawMediaBytesMoved, 0);
      const outbound = JSON.stringify(checkpoint.state.cloudEvent);
      assert.doesNotMatch(outbound, /rawMedia|localId|capturedAt/);
    }
  });

  it('makes the custom-model boundary explicit without claiming product or model execution', () => {
    const source = readJson<IndustrialVisionSource>(
      INDUSTRIAL_VISION_SOURCE_PATH
    );

    assert.equal(
      source.executionLabels.architecture,
      'deterministic-simulation'
    );
    assert.equal(
      source.executionLabels.expansoPolicy,
      'executed-policy-simulator'
    );
    assert.equal(
      source.executionLabels.customModelOutput,
      'curated-synthetic-envelope'
    );
    assert.ok(source.boundary.expansoCentral.length > 0);
    assert.ok(source.boundary.customModel.includes('run inference'));
    assert.ok(
      source.excludedClaims.includes(
        'No camera, custom model, or Expanso binary was executed.'
      )
    );
  });

  it('reuses the spine policy with a second bounded synthetic scenario pack', () => {
    const source = readJson<IndustrialVisionSource>(
      INDUSTRIAL_VISION_SOURCE_PATH
    );

    assert.equal(source.scenarios.length, 2);
    assert.deepEqual(
      source.scenarios.map((scenario) => scenario.kind),
      ['industrial-inspection', 'utility-damage-reuse-proof']
    );
    assert.equal(source.scenarios[1].reuseDemonstrationOnly, true);
  });

  it('binds synthetic fixture rights to the repository policy and exact generator', () => {
    const rights = readJson<{
      policyDigest: string;
      datasets: Array<{
        kind: string;
        deterministic: boolean;
        dataRightsVerdict: string;
        fixturePaths: string[];
        generation: {
          generatorPath: string;
          generatorSha256: string;
          seed: string;
        };
      }>;
    }>(DATA_RIGHTS_PATH);
    const dataset = rights.datasets[0];

    assert.equal(rights.policyDigest, digest(DATASET_POLICY_PATH));
    assert.equal(dataset.kind, 'synthetic');
    assert.equal(dataset.deterministic, true);
    assert.equal(dataset.dataRightsVerdict, 'allowed');
    assert.deepEqual(dataset.fixturePaths, [
      INDUSTRIAL_VISION_SOURCE_PATH,
      INDUSTRIAL_VISION_CHECKPOINT_PATH,
    ]);
    assert.equal(
      dataset.generation.generatorSha256,
      digest(dataset.generation.generatorPath)
    );
    assert.equal(dataset.generation.seed, INDUSTRIAL_VISION_SEED);
    const localUserMarker = ['', 'Us', 'ers', ''].join('/');
    const privateRepositoryMarker = ['second', 'brain'].join('-');
    assert.doesNotMatch(
      readFileSync(resolve(DATA_RIGHTS_PATH), 'utf8'),
      new RegExp(
        `(?:^|[\\s\`"'])${localUserMarker}|${privateRepositoryMarker}(?:/|\\b)`,
        'iu'
      )
    );
  });
});
