import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';

import {
  applyRuntimeEvent,
  runRuntimeScenario,
  validateCheckpointArtifact,
  validateRuntimeSource,
} from '../../../src/components/ExplorerV2/runtime/disconnectedEdgeMachine';
import type {
  RuntimeCheckpointArtifact,
  RuntimeProofEvidence,
  RuntimeSource,
} from '../../../src/components/ExplorerV2/runtime/types';

const root = process.cwd();
const sourcePath = resolve(
  root,
  'src/components/ExplorerV2/runtime/proof/disconnected-edge-source.json'
);
const checkpointPath = resolve(
  root,
  'src/components/ExplorerV2/runtime/proof/disconnected-edge-checkpoints.json'
);
const evidencePath = resolve(
  root,
  'src/components/ExplorerV2/runtime/proof/disconnected-edge-evidence.json'
);
const stateMachinePath = resolve(
  root,
  'src/components/ExplorerV2/runtime/disconnectedEdgeMachine.ts'
);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function digest(path: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

describe('Disconnected-edge runtime Explorer proof', () => {
  it('replays every scenario to the checked-in checkpoint artifact', () => {
    const source = validateRuntimeSource(readJson<RuntimeSource>(sourcePath));
    const checkpoints = validateCheckpointArtifact(
      source,
      readJson<RuntimeCheckpointArtifact>(checkpointPath)
    );

    for (const scenario of source.scenarios) {
      const states = runRuntimeScenario(scenario);
      const expected = checkpoints.scenarios.find(
        (candidate) => candidate.scenarioId === scenario.id
      );
      assert.deepEqual(
        states,
        expected?.checkpoints.map((checkpoint) => checkpoint.state)
      );
    }
  });

  it('reset and replay produce the same deterministic state sequence', () => {
    const source = validateRuntimeSource(readJson<RuntimeSource>(sourcePath));
    const scenario = source.scenarios.find(
      (candidate) => candidate.id === 'link-drop'
    )!;

    assert.deepEqual(
      runRuntimeScenario(scenario),
      runRuntimeScenario(scenario)
    );
    assert.deepEqual(runRuntimeScenario(scenario)[0], {
      tick: 0,
      connection: 'online',
      queue: [],
      delivered: [],
      processedEventIds: [],
    });
  });

  it('prioritizes the critical buffered record and preserves replay order', () => {
    const source = validateRuntimeSource(readJson<RuntimeSource>(sourcePath));
    const states = runRuntimeScenario(source.scenarios[0]);

    assert.deepEqual(
      states[4].queue.map((record) => record.id),
      ['critical-001', 'normal-002']
    );
    assert.deepEqual(
      states.at(-1)?.delivered.map((record) => record.id),
      ['normal-001', 'critical-001', 'normal-002']
    );
  });

  it('rejects undeclared control values and invalid replay conditions', () => {
    const source = readJson<RuntimeSource>(sourcePath);
    const invalid = structuredClone(source);
    invalid.scenarios[0].events[1] = {
      id: 'link-invalid',
      kind: 'link-state',
      at: 2,
      connection: 'degraded' as never,
    };
    assert.throws(() => validateRuntimeSource(invalid), /invalid link state/);

    assert.throws(
      () =>
        applyRuntimeEvent(
          {
            tick: 0,
            connection: 'offline',
            queue: [],
            delivered: [],
            processedEventIds: [],
          },
          { id: 'invalid-replay', kind: 'replay-buffer', at: 1 }
        ),
      /cannot replay while the link is offline/
    );
  });

  it('binds deterministic-simulation provenance to exact source and checkpoint bytes', () => {
    const evidence = readJson<RuntimeProofEvidence>(evidencePath);

    assert.equal(evidence.kind, 'deterministic-simulation');
    assert.equal(evidence.sourceSha256, digest(sourcePath));
    assert.equal(evidence.checkpointSha256, digest(checkpointPath));
    assert.equal(evidence.stateMachineSha256, digest(stateMachinePath));
    assert.deepEqual(evidence.toolVersions, {
      node: '26.5.0',
      tsx: readJson<{ version: string }>(
        resolve(root, 'node_modules/tsx/package.json')
      ).version,
      typescript: readJson<{ version: string }>(
        resolve(root, 'node_modules/typescript/package.json')
      ).version,
      react: readJson<{ version: string }>(
        resolve(root, 'node_modules/react/package.json')
      ).version,
      playwright: readJson<{ version: string }>(
        resolve(root, 'node_modules/@playwright/test/package.json')
      ).version,
      axeCore: readJson<{ version: string }>(
        resolve(root, 'node_modules/@axe-core/playwright/package.json')
      ).version,
    });
    assert.match(
      evidence.environment,
      /no network, clock, random input, or Expanso process/
    );
    assert.ok(
      evidence.excludedClaims.includes('No Expanso pipeline was executed')
    );
  });
});
