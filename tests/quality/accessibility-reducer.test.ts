import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  loadAccessibilityContract,
  parseAccessibilityRoutes,
} from '../../scripts/quality/accessibility-lib';
import { produceAccessibilityResult } from '../../scripts/quality/produce-accessibility-result';
import {
  accessibilityGatePasses,
  reduceAccessibility,
} from '../../scripts/quality/reduce-accessibility';

const SUBJECT_SHA = 'a'.repeat(40);
const ENVIRONMENT_ID = 'test-linux-x64';
const root = mkdtempSync(join(tmpdir(), 'accessibility-evidence-'));
const observationInput = join(root, 'observation-input.json');
const evidenceRoot = join(root, 'evidence');
const resultPath = join(evidenceRoot, 'accessibility-result.json');
let validResult: Record<string, any>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function digest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function reduce(value: unknown) {
  return reduceAccessibility(value, {
    expectedSubjectSha: SUBJECT_SHA,
    expectedEnvironmentId: ENVIRONMENT_ID,
    evidenceRoot,
  });
}

before(() => {
  assert.ok(
    existsSync('build/sitemap.xml'),
    'accessibility reducer tests require npm run build first'
  );
  writeFileSync(
    observationInput,
    `${JSON.stringify(
      {
        manifestVersion: 'accessibility-observations-v1',
        startedAt: '2026-07-18T12:00:00.000Z',
        finishedAt: '2026-07-18T12:01:00.000Z',
        environment: {
          platform: 'linux',
          architecture: 'x64',
          node: '20.19.4',
          playwright: '1.55.1',
        },
        observations: [],
        runnerErrors: [],
        capabilityBlocks: ['Chromium unavailable in reducer fixture'],
      },
      null,
      2
    )}\n`
  );
  validResult = produceAccessibilityResult({
    subjectSha: SUBJECT_SHA,
    environmentId: ENVIRONMENT_ID,
    observationPath: observationInput,
    evidenceRoot,
    outputPath: resultPath,
  });
});

after(() => rmSync(root, { recursive: true, force: true }));

describe('accessibility evidence producer and reducer', () => {
  it('includes the test-only runtime harness without a production artifact', () => {
    const contract = loadAccessibilityContract();
    const routes = parseAccessibilityRoutes(contract);
    const runtimeProof = routes.find(
      (route) => route.path === '/__explorer-runtime-proof/'
    );

    assert.ok(runtimeProof);
    assert.deepEqual(runtimeProof.capabilities, {
      explorerV2: false,
      interactionMode: 'runtime',
    });
    assert.equal(
      existsSync('build/__explorer-runtime-proof/index.html'),
      false
    );
  });

  it('emits one explicit cell per inventory route and declared local oracle', () => {
    const contract = loadAccessibilityContract();
    const routes = parseAccessibilityRoutes(contract);
    assert.equal(
      validResult.cells.length,
      routes.length * contract.cells.localRequired.length
    );
    assert.equal(
      validResult.claimCells.length,
      contract.cells.claimBoundRequired.length
    );
    assert.equal(
      validResult.stateCells.length,
      contract.materiallyDistinctStates.length
    );
    assert.equal(validResult.subjectSha, SUBJECT_SHA);
    assert.notEqual(validResult.subjectSha, '0'.repeat(40));
    assert.match(validResult.environmentArtifactSha256, /^[a-f0-9]{64}$/);
    assert.match(validResult.evidenceArtifactSha256, /^[a-f0-9]{64}$/);
    assert.ok(
      validResult.cells.every((cell: any) => cell.status === 'UNKNOWN')
    );
  });

  it('passes evidence integrity while preserving complete UNKNOWN subject coverage', () => {
    const result = reduce(validResult);
    assert.equal(result.status, 'PASS', JSON.stringify(result.errors, null, 2));
    assert.equal(result.resultStatus, 'UNKNOWN');
    assert.equal(result.coverageStatus, 'UNKNOWN');
    assert.equal(result.errors.length, 0);
    assert.equal(result.unknowns.length, 0);
    assert.equal(result.summary.missingLocalCells, 0);
  });

  it('allows the scoped local browser gate to PASS while extended coverage stays explicit', () => {
    const contract = loadAccessibilityContract();
    const routes = parseAccessibilityRoutes(contract);
    const explorerRoute = routes.find((route) => route.capabilities.explorerV2);
    const observations = routes.flatMap((route) =>
      contract.cells.localRequired
        .filter(
          (oracle) =>
            oracle.requiredCoverage.routeCapability === 'all' ||
            route.capabilities.explorerV2
        )
        .map((oracle, index) => ({
          observationVersion: '1.0.0',
          oracleId: oracle.id,
          routePath: route.path,
          status: 'PASS',
          environmentIds: oracle.requiredCoverage.environments,
          themes: oracle.requiredCoverage.themes,
          interactionModes:
            route.capabilities.interactionMode === 'none'
              ? []
              : [route.capabilities.interactionMode],
          stateIds:
            explorerRoute?.id === route.id && index === 0
              ? contract.materiallyDistinctStates
              : [],
          browserVersion: contract.tools.chromium,
          projectName: 'reducer-fixture',
          durationMs: 1,
          reasons: [],
        }))
    );
    const passObservationPath = join(root, 'passing-observations.json');
    const passEvidenceRoot = join(root, 'passing-evidence');
    const passResultPath = join(passEvidenceRoot, 'accessibility-result.json');
    writeFileSync(
      passObservationPath,
      `${JSON.stringify({
        manifestVersion: 'accessibility-observations-v1',
        startedAt: '2026-07-18T12:00:00.000Z',
        finishedAt: '2026-07-18T12:01:00.000Z',
        environment: {
          platform: 'linux',
          architecture: 'x64',
          node: '20.19.4',
          playwright: contract.tools.playwright,
        },
        observations,
        runnerErrors: [],
        capabilityBlocks: [],
      })}\n`
    );
    const result = produceAccessibilityResult({
      subjectSha: SUBJECT_SHA,
      environmentId: ENVIRONMENT_ID,
      observationPath: passObservationPath,
      evidenceRoot: passEvidenceRoot,
      outputPath: passResultPath,
    });
    assert.equal(result.status, 'PASS');
    assert.notEqual(result.coverageStatus, 'PASS');

    const reduction = reduceAccessibility(result, {
      expectedSubjectSha: SUBJECT_SHA,
      expectedEnvironmentId: ENVIRONMENT_ID,
      evidenceRoot: passEvidenceRoot,
    });
    assert.equal(reduction.status, 'PASS');
    assert.equal(reduction.resultStatus, 'PASS');
    assert.notEqual(reduction.coverageStatus, 'PASS');
    assert.equal(accessibilityGatePasses(reduction), true);

    const passManifest = JSON.parse(readFileSync(passObservationPath, 'utf8'));
    const runtimeRoute = routes.find(
      (route) => route.capabilities.interactionMode === 'runtime'
    );
    const nonInteractiveRoute = routes.find(
      (route) => route.capabilities.interactionMode === 'none'
    );
    assert.ok(runtimeRoute);
    assert.ok(nonInteractiveRoute);
    for (const [label, routePath, wrongMode] of [
      ['runtime-as-transformation', runtimeRoute.path, 'transformation'],
      ['transformation-as-runtime', explorerRoute?.path, 'runtime'],
      ['none-as-transformation', nonInteractiveRoute.path, 'transformation'],
    ] as const) {
      assert.ok(routePath);
      const swappedManifest = clone(passManifest);
      const swappedObservation = swappedManifest.observations.find(
        (observation: any) =>
          observation.routePath === routePath &&
          observation.oracleId === 'chromium-structural-scan'
      );
      assert.ok(swappedObservation);
      swappedObservation.interactionModes = [wrongMode];
      const swappedObservationPath = join(root, `${label}-observations.json`);
      const swappedEvidenceRoot = join(root, `${label}-evidence`);
      const swappedResultPath = join(
        swappedEvidenceRoot,
        'accessibility-result.json'
      );
      writeFileSync(
        swappedObservationPath,
        `${JSON.stringify(swappedManifest)}\n`
      );
      const swappedResult = produceAccessibilityResult({
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        observationPath: swappedObservationPath,
        evidenceRoot: swappedEvidenceRoot,
        outputPath: swappedResultPath,
      });
      const swappedReduction = reduceAccessibility(swappedResult, {
        expectedSubjectSha: SUBJECT_SHA,
        expectedEnvironmentId: ENVIRONMENT_ID,
        evidenceRoot: swappedEvidenceRoot,
      });
      assert.equal(swappedReduction.status, 'PASS');
      assert.equal(swappedReduction.resultStatus, 'UNKNOWN');
      assert.equal(accessibilityGatePasses(swappedReduction), false);
    }

    const failingManifest = JSON.parse(
      readFileSync(passObservationPath, 'utf8')
    );
    failingManifest.observations[0].status = 'FAIL';
    failingManifest.observations[0].reasons = ['Target oracle failed'];
    const failingObservationPath = join(root, 'failing-observations.json');
    const failingEvidenceRoot = join(root, 'failing-evidence');
    const failingResultPath = join(
      failingEvidenceRoot,
      'accessibility-result.json'
    );
    writeFileSync(
      failingObservationPath,
      `${JSON.stringify(failingManifest)}\n`
    );
    const failingResult = produceAccessibilityResult({
      subjectSha: SUBJECT_SHA,
      environmentId: ENVIRONMENT_ID,
      observationPath: failingObservationPath,
      evidenceRoot: failingEvidenceRoot,
      outputPath: failingResultPath,
    });
    const failingReduction = reduceAccessibility(failingResult, {
      expectedSubjectSha: SUBJECT_SHA,
      expectedEnvironmentId: ENVIRONMENT_ID,
      evidenceRoot: failingEvidenceRoot,
    });
    assert.equal(failingReduction.status, 'PASS');
    assert.equal(failingReduction.resultStatus, 'FAIL');
    assert.equal(accessibilityGatePasses(failingReduction), false);
  });

  it('reduces a missing required route/oracle cell to UNKNOWN, never PASS', () => {
    const input = clone(validResult);
    input.cells.pop();
    input.status = 'UNKNOWN';
    const result = reduce(input);
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.errors.length, 0);
    assert.equal(result.summary.missingLocalCells, 1);
    assert.match(
      result.unknowns.join('\n'),
      /required route\/oracle cells are missing/
    );

    input.status = 'PASS';
    const forged = reduce(input);
    assert.equal(forged.status, 'FAIL');
    assert.match(
      forged.errors.join('\n'),
      /cannot be PASS while required cells are missing/
    );
  });

  it('reduces a missing materially distinct state cell to UNKNOWN', () => {
    const input = clone(validResult);
    input.stateCells.pop();
    const result = reduce(input);
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.summary.missingStateCells, 1);
    assert.match(
      result.unknowns.join('\n'),
      /materially distinct state cells are missing/
    );
  });

  it('fails a fabricated cell PASS and a duplicated or extra cell', () => {
    const fabricated = clone(validResult);
    fabricated.cells[0].status = 'PASS';
    fabricated.cells[0].reasons = [];
    assert.match(
      reduce(fabricated).errors.join('\n'),
      /independently reduced evidence/
    );

    const duplicate = clone(validResult);
    duplicate.cells.push(clone(duplicate.cells[0]));
    assert.match(reduce(duplicate).errors.join('\n'), /duplicates/);

    const extra = clone(validResult);
    extra.cells.push({ ...clone(extra.cells[0]), id: 'not-declared' });
    assert.match(reduce(extra).errors.join('\n'), /extra cell/);
  });

  it('fails stale subject, contract, environment, and evidence bindings', () => {
    for (const [field, value, expected] of [
      ['subjectSha', 'b'.repeat(40), /expected subject SHA/],
      ['subjectSha', '0'.repeat(40), /all-zero SHA/],
      ['contractSha256', 'b'.repeat(64), /exact contract digest/],
      ['environmentId', 'wrong-environment', /expected environment/],
      [
        'environmentArtifactSha256',
        'b'.repeat(64),
        /environment artifact binding/,
      ],
      ['evidenceArtifactSha256', 'b'.repeat(64), /evidence artifact binding/],
    ] as const) {
      const input = clone(validResult);
      input[field] = value;
      assert.match(reduce(input).errors.join('\n'), expected, field);
    }
  });

  it('fails changed artifact bytes even when the result still claims the old digest', () => {
    const evidenceArtifact = validResult.artifacts.find(
      (entry: any) => entry.id === 'playwright-observations'
    );
    const path = join(evidenceRoot, evidenceArtifact.path);
    const original = readFileSync(path);
    writeFileSync(path, `${original.toString('utf8')}tampered\n`);
    try {
      const result = reduce(validResult);
      assert.equal(result.status, 'FAIL');
      assert.match(result.errors.join('\n'), /byte count|digest mismatch/);
      assert.notEqual(digest(path), evidenceArtifact.sha256);
    } finally {
      writeFileSync(path, original);
    }
  });

  it('rejects a zero subject before producing any result', () => {
    assert.throws(
      () =>
        produceAccessibilityResult({
          subjectSha: '0'.repeat(40),
          environmentId: ENVIRONMENT_ID,
          observationPath: observationInput,
          evidenceRoot,
          outputPath: resultPath,
        }),
      /nonzero lowercase 40-character Git SHA/
    );
  });
});
