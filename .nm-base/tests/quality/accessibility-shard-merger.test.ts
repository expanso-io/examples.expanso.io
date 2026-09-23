import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  loadAccessibilityContract,
  parseAccessibilityRoutes,
  type AccessibilityObservation,
  type AccessibilityObservationManifest,
} from '../../scripts/quality/accessibility-lib';
import {
  mergeAccessibilityShards,
  writeAccessibilityShardManifest,
} from '../../scripts/quality/merge-accessibility-shards';

const SUBJECT_SHA = 'a'.repeat(40);
const ENVIRONMENT_ID = 'github-actions-linux-x64';
const SHARD_TOTAL = 4;
const roots: string[] = [];

function observation(index: number): AccessibilityObservation {
  const contract = loadAccessibilityContract();
  const routes = parseAccessibilityRoutes(contract);
  const oracle = contract.cells.localRequired[index];
  return {
    observationVersion: '1.0.0',
    oracleId: oracle.id,
    routePath: routes[0].path,
    status: 'PASS',
    environmentIds: oracle.requiredCoverage.environments,
    themes: oracle.requiredCoverage.themes,
    interactionModes: [],
    stateIds: [],
    browserVersion: contract.tools.chromium,
    projectName: 'chromium-desktop',
    durationMs: index + 1,
    reasons: [],
  };
}

function manifest(
  index: number,
  observations = [observation(index - 1)]
): AccessibilityObservationManifest {
  return {
    manifestVersion: 'accessibility-observations-v1',
    startedAt: `2026-07-24T12:0${index}:00.000Z`,
    finishedAt: `2026-07-24T12:1${index}:00.000Z`,
    environment: {
      platform: 'linux',
      architecture: 'x64',
      node: '20.19.4',
      playwright: loadAccessibilityContract().tools.playwright,
    },
    observations,
    runnerErrors: [],
    capabilityBlocks: [],
  };
}

function fixture(): {
  root: string;
  inputRoot: string;
  outputPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'accessibility-shards-'));
  roots.push(root);
  const inputRoot = join(root, 'inputs');
  mkdirSync(inputRoot);
  for (let index = 1; index <= SHARD_TOTAL; index += 1) {
    const shardRoot = join(inputRoot, String(index));
    mkdirSync(shardRoot);
    const observationPath = join(shardRoot, 'playwright-observations.json');
    writeFileSync(
      observationPath,
      `${JSON.stringify(manifest(index), null, 2)}\n`
    );
    writeAccessibilityShardManifest({
      subjectSha: SUBJECT_SHA,
      environmentId: ENVIRONMENT_ID,
      shardIndex: index,
      shardTotal: SHARD_TOTAL,
      observationPath,
      outputPath: join(shardRoot, 'accessibility-shard-manifest.json'),
    });
  }
  return {
    root,
    inputRoot,
    outputPath: join(root, 'merged', 'playwright-observations.json'),
  };
}

function merge(inputRoot: string, outputPath: string) {
  return mergeAccessibilityShards({
    inputRoot,
    outputPath,
    subjectSha: SUBJECT_SHA,
    environmentId: ENVIRONMENT_ID,
    shardTotal: SHARD_TOTAL,
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('accessibility shard merger', () => {
  it('merges exactly four complete, bound shard manifests', () => {
    const { inputRoot, outputPath } = fixture();
    const result = merge(inputRoot, outputPath);
    assert.equal(result.observations.length, SHARD_TOTAL);
    assert.equal(result.startedAt, '2026-07-24T12:01:00.000Z');
    assert.equal(result.finishedAt, '2026-07-24T12:14:00.000Z');
    assert.deepEqual(
      result.observations.map(({ oracleId }) => oracleId).sort(),
      Array.from(
        { length: SHARD_TOTAL },
        (_, index) => loadAccessibilityContract().cells.localRequired[index].id
      ).sort()
    );
    assert.deepEqual(JSON.parse(readFileSync(outputPath, 'utf8')), result);
  });

  it('rejects a missing shard', () => {
    const { inputRoot, outputPath } = fixture();
    rmSync(join(inputRoot, '3'), { recursive: true });
    assert.throws(
      () => merge(inputRoot, outputPath),
      /shards are missing or unexpected/
    );
  });

  it('rejects a duplicate observation across shards', () => {
    const { inputRoot, outputPath } = fixture();
    const shardRoot = join(inputRoot, '2');
    const observationPath = join(shardRoot, 'playwright-observations.json');
    writeFileSync(
      observationPath,
      `${JSON.stringify(manifest(2, [observation(0)]), null, 2)}\n`
    );
    writeAccessibilityShardManifest({
      subjectSha: SUBJECT_SHA,
      environmentId: ENVIRONMENT_ID,
      shardIndex: 2,
      shardTotal: SHARD_TOTAL,
      observationPath,
      outputPath: join(shardRoot, 'accessibility-shard-manifest.json'),
    });
    assert.throws(
      () => merge(inputRoot, outputPath),
      /Duplicate accessibility observation across shards/
    );
  });

  it('rejects a mismatched environment binding', () => {
    const { inputRoot, outputPath } = fixture();
    const path = join(inputRoot, '2', 'accessibility-shard-manifest.json');
    const value = JSON.parse(readFileSync(path, 'utf8'));
    value.environmentId = 'swapped-environment';
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    assert.throws(() => merge(inputRoot, outputPath), /environmentId mismatch/);
  });

  it('rejects a cross-runner observation environment mismatch', () => {
    const { inputRoot, outputPath } = fixture();
    const shardRoot = join(inputRoot, '2');
    const observationPath = join(shardRoot, 'playwright-observations.json');
    const value = JSON.parse(readFileSync(observationPath, 'utf8'));
    value.environment.architecture = 'arm64';
    writeFileSync(observationPath, `${JSON.stringify(value, null, 2)}\n`);
    writeAccessibilityShardManifest({
      subjectSha: SUBJECT_SHA,
      environmentId: ENVIRONMENT_ID,
      shardIndex: 2,
      shardTotal: SHARD_TOTAL,
      observationPath,
      outputPath: join(shardRoot, 'accessibility-shard-manifest.json'),
    });
    assert.throws(
      () => merge(inputRoot, outputPath),
      /observation environment mismatch/
    );
  });

  it('preserves runner errors and capability blocks for fail-closed reduction', () => {
    const { inputRoot, outputPath } = fixture();
    const shardRoot = join(inputRoot, '3');
    const observationPath = join(shardRoot, 'playwright-observations.json');
    const value = JSON.parse(readFileSync(observationPath, 'utf8'));
    value.runnerErrors = ['shard runner failed after observation'];
    value.capabilityBlocks = ['pinned Chromium was unavailable'];
    writeFileSync(observationPath, `${JSON.stringify(value, null, 2)}\n`);
    writeAccessibilityShardManifest({
      subjectSha: SUBJECT_SHA,
      environmentId: ENVIRONMENT_ID,
      shardIndex: 3,
      shardTotal: SHARD_TOTAL,
      observationPath,
      outputPath: join(shardRoot, 'accessibility-shard-manifest.json'),
    });
    const result = merge(inputRoot, outputPath);
    assert.deepEqual(result.runnerErrors, [
      'shard runner failed after observation',
    ]);
    assert.deepEqual(result.capabilityBlocks, [
      'pinned Chromium was unavailable',
    ]);
  });

  it('rejects shard artifacts swapped between numbered inputs', () => {
    const { inputRoot, outputPath } = fixture();
    const left = join(inputRoot, '1', 'accessibility-shard-manifest.json');
    const right = join(inputRoot, '2', 'accessibility-shard-manifest.json');
    const temporary = join(inputRoot, 'swapped-manifest.json');
    cpSync(left, temporary);
    cpSync(right, left);
    cpSync(temporary, right);
    rmSync(temporary);
    assert.throws(() => merge(inputRoot, outputPath), /shardIndex mismatch/);
  });
});
