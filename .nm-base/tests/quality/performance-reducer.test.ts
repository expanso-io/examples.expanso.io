import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { loadContract, sha256Bytes } from '../../scripts/quality/contract-lib';
import {
  artifactForFile,
  collectProductionAssetEvidence,
  writeJsonEvidenceArtifact,
  writePerformanceEvidenceManifest,
  type ArtifactRecord,
  type BrowserMetrics,
  type PerformanceEvidenceManifest,
} from '../../scripts/quality/performance-evidence';
import {
  reducePerformanceEvidence,
  type PerformanceReductionOptions,
} from '../../scripts/quality/reduce-performance';

const BASELINE_SHA = 'a'.repeat(40);
const CANDIDATE_SHA = 'b'.repeat(40);
const ENVIRONMENT_ID = 'test-linux-x64-run-1';
const NOW = new Date('2026-07-18T12:00:00.000Z');
const contract = loadContract('tests/contracts/performance-v1.json');
const temporaryRoots: string[] = [];

interface Bundle {
  root: string;
  manifestPath: string;
  manifest: PerformanceEvidenceManifest;
}

function write(path: string, value: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function createBundle(
  parent: string,
  role: 'baseline' | 'candidate',
  options: {
    subjectSha?: string;
    contractSha256?: string;
    finishedAt?: string;
    omitPageLoadCell?: boolean;
  } = {}
): Bundle {
  const root = resolve(parent, role);
  const buildRoot = resolve(parent, `${role}-build`);
  const docusaurusRoot = resolve(parent, `${role}-docusaurus`);
  mkdirSync(root, { recursive: true });
  const sharedJs =
    role === 'baseline'
      ? 'shared-baseline'.repeat(20)
      : 'shared-candidate'.repeat(12);
  const globalCss = 'global-css'.repeat(15);
  const explorerJs =
    role === 'baseline'
      ? 'explorer-baseline'.repeat(8)
      : 'explorer-candidate'.repeat(9);
  write(resolve(buildRoot, 'assets/js/main.js'), sharedJs);
  write(resolve(buildRoot, 'assets/css/main.css'), globalCss);
  write(resolve(buildRoot, 'assets/js/explorer.js'), explorerJs);
  write(
    resolve(docusaurusRoot, 'client-manifest.json'),
    `${JSON.stringify({
      entrypoints: ['main'],
      origins: { main: [1, 2], explorer: [3] },
      assets: {
        1: { js: [{ file: 'assets/js/main.js' }] },
        2: { css: [{ file: 'assets/css/main.css' }] },
        3: { js: [{ file: 'assets/js/explorer.js' }] },
      },
    })}\n`
  );
  const explorerRoute = String(
    contract.routes.required.find((route) => route.id === 'remove-pii-pilot')
      ?.path
  );
  write(
    resolve(docusaurusRoot, 'routesChunkNames.json'),
    `${JSON.stringify({
      [`${explorerRoute}/-test`]: { content: 'explorer' },
    })}\n`
  );
  const assetEvidence = collectProductionAssetEvidence({
    buildRoot,
    docusaurusRoot,
    evidenceRoot: root,
    explorerRoute,
  });
  const artifacts: ArtifactRecord[] = [...assetEvidence.artifacts];

  const tracePath = resolve(root, 'raw/traces/all-cells.zip');
  write(tracePath, Buffer.from(`trace-${role}`));
  const trace = artifactForFile(root, tracePath, {
    id: 'trace:all-cells',
    kind: 'playwright-trace',
    mediaType: 'application/zip',
  });
  artifacts.push(trace);
  const report = writeJsonEvidenceArtifact(
    root,
    'raw/lighthouse/report.json',
    { lighthouseVersion: contract.tools.lighthouse, role },
    { id: 'lighthouse:all-routes', kind: 'lighthouse-report' }
  );
  artifacts.push(report);

  const requiredRoutes = contract.routes.required.filter(
    (route) => route.availableWhen === undefined
  );
  const profiles = Object.keys(contract.profiles as Record<string, unknown>);
  const themes = contract.themes as string[];
  const pageLoadCells = requiredRoutes.flatMap((route) =>
    profiles.flatMap((profileId) =>
      themes.map((theme) => ({
        routeId: route.id,
        profileId,
        theme,
        cacheMode: 'cold-page-load' as const,
        traceArtifactId: trace.id,
        runs: Array.from(
          {
            length: Number(
              (contract.runs as Record<string, unknown>).pageLoadsPerCell
            ),
          },
          (_, index) => ({
            lcpMs: 900 + index,
            cls: 0.01,
            overflowCssPixels: 0,
          })
        ),
      }))
    )
  );
  if (options.omitPageLoadCell) pageLoadCells.pop();
  const stageIds = ['Stage 1 of 2: Input', 'Stage 2 of 2: Output'];
  const runs = contract.runs as Record<string, number>;
  const metrics: BrowserMetrics = {
    metricsVersion: '1.0.0',
    subjectSha:
      options.subjectSha ??
      (role === 'baseline' ? BASELINE_SHA : CANDIDATE_SHA),
    contractSha256: options.contractSha256 ?? contract.contractSha256,
    pageLoadCells,
    lighthouseCells: requiredRoutes.map((route) => ({
      routeId: route.id,
      lcpMs: 1000,
      cls: 0.01,
      reportArtifactId: report.id,
    })),
    explorer: {
      routeId: 'remove-pii-pilot',
      stageIds,
      warmups: runs.explorerWarmups,
      measuredTransitions: runs.explorerMeasuredTransitions,
      scriptingMs: Array.from(
        { length: runs.explorerMeasuredTransitions },
        () => 20
      ),
      eventDurationsMs: [16, 24, 16, 24],
      traceArtifactId: trace.id,
    },
  };
  artifacts.push(
    writeJsonEvidenceArtifact(root, 'raw/browser-metrics.json', metrics, {
      id: 'browser-metrics',
      kind: 'browser-metrics',
    })
  );
  const finishedAt = options.finishedAt ?? '2026-07-18T11:55:00.000Z';
  const manifest: PerformanceEvidenceManifest = {
    evidenceVersion: '1.0.0',
    role,
    contractId: 'performance-v1',
    contractSha256: options.contractSha256 ?? contract.contractSha256,
    subjectSha:
      options.subjectSha ??
      (role === 'baseline' ? BASELINE_SHA : CANDIDATE_SHA),
    environmentId: ENVIRONMENT_ID,
    startedAt: new Date(new Date(finishedAt).valueOf() - 60_000).toISOString(),
    finishedAt,
    capability: { status: 'AVAILABLE' },
    fixtureIds: contract.fixtures.map((fixture) => fixture.id),
    stageIds,
    toolVersions: { ...contract.tools },
    artifacts: artifacts.sort((left, right) => left.id.localeCompare(right.id)),
  };
  const manifestPath = writePerformanceEvidenceManifest(root, manifest);
  return { root, manifestPath, manifest };
}

function reductionOptions(
  baseline: Bundle,
  candidate: Bundle
): PerformanceReductionOptions {
  return {
    expectedBaselineSha: BASELINE_SHA,
    expectedCandidateSha: CANDIDATE_SHA,
    expectedEnvironmentId: ENVIRONMENT_ID,
    baselineEvidenceRoot: baseline.root,
    candidateEvidenceRoot: candidate.root,
    baselineManifestPath: baseline.manifestPath,
    candidateManifestPath: candidate.manifestPath,
    now: NOW,
  };
}

function bundles(): { baseline: Bundle; candidate: Bundle } {
  const root = mkdtempSync(resolve(tmpdir(), 'performance-reducer-'));
  temporaryRoots.push(root);
  return {
    baseline: createBundle(root, 'baseline'),
    candidate: createBundle(root, 'candidate'),
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('performance evidence reducer', () => {
  it('compares exact-SHA baseline and candidate using production chunk attribution', () => {
    const { baseline, candidate } = bundles();
    const result = reducePerformanceEvidence(
      baseline.manifest,
      candidate.manifest,
      reductionOptions(baseline, candidate)
    );

    assert.equal(result.status, 'PASS', result.errors.join('\n'));
    assert.equal(result.contractSha256, contract.contractSha256);
    assert.equal(result.baselineSha, BASELINE_SHA);
    assert.equal(result.candidateSha, CANDIDATE_SHA);
    assert.ok(
      (result.measurements.candidate.explorerJavaScriptGzipBytes ?? 0) > 0
    );
    assert.equal(result.measurements.candidate.explorerCssGzipBytes, 0);
    assert.equal(
      result.measurements.candidate.explorerIncrementGzipBytes,
      result.measurements.candidate.explorerJavaScriptGzipBytes
    );
    assert.equal(result.measurements.comparison.length, 8);
    assert.ok(result.rawTraces.some((trace) => trace.role === 'baseline'));
    assert.ok(result.rawTraces.some((trace) => trace.role === 'candidate'));
  });

  it('fails closed when the baseline manifest is missing', () => {
    const { baseline, candidate } = bundles();
    const result = reducePerformanceEvidence(
      undefined,
      candidate.manifest,
      reductionOptions(baseline, candidate)
    );
    assert.equal(result.status, 'FAIL');
    assert.match(result.errors.join('\n'), /missing evidence manifest/);
  });

  it('rejects stale baseline evidence', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'performance-reducer-'));
    temporaryRoots.push(root);
    const baseline = createBundle(root, 'baseline', {
      finishedAt: '2026-07-18T08:00:00.000Z',
    });
    const candidate = createBundle(root, 'candidate');
    const result = reducePerformanceEvidence(
      baseline.manifest,
      candidate.manifest,
      reductionOptions(baseline, candidate)
    );
    assert.equal(result.status, 'FAIL');
    assert.match(result.errors.join('\n'), /baseline: evidence is stale/);
  });

  it('rejects fabricated raw evidence whose claimed digest does not match bytes', () => {
    const { baseline, candidate } = bundles();
    const trace = baseline.manifest.artifacts.find(
      (artifact) => artifact.kind === 'playwright-trace'
    );
    assert.ok(trace);
    writeFileSync(resolve(baseline.root, trace.path), 'fabricated trace bytes');

    const result = reducePerformanceEvidence(
      baseline.manifest,
      candidate.manifest,
      reductionOptions(baseline, candidate)
    );
    assert.equal(result.status, 'FAIL');
    assert.match(result.errors.join('\n'), /digest mismatch/);
  });

  it('fails exact candidate SHA and contract digest binding', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'performance-reducer-'));
    temporaryRoots.push(root);
    const baseline = createBundle(root, 'baseline');
    const candidate = createBundle(root, 'candidate', {
      subjectSha: 'c'.repeat(40),
      contractSha256: 'd'.repeat(64),
    });
    const result = reducePerformanceEvidence(
      baseline.manifest,
      candidate.manifest,
      reductionOptions(baseline, candidate)
    );
    assert.equal(result.status, 'FAIL');
    assert.match(
      result.errors.join('\n'),
      /candidate: contract digest mismatch/
    );
    assert.match(result.errors.join('\n'), /candidate: subjectSha mismatch/);
  });

  it('reduces missing metric data to UNKNOWN without manufacturing a pass', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'performance-reducer-'));
    temporaryRoots.push(root);
    const baseline = createBundle(root, 'baseline');
    const candidate = createBundle(root, 'candidate', {
      omitPageLoadCell: true,
    });
    const result = reducePerformanceEvidence(
      baseline.manifest,
      candidate.manifest,
      reductionOptions(baseline, candidate)
    );
    assert.equal(result.status, 'UNKNOWN', result.errors.join('\n'));
    assert.match(result.errors.join('\n'), /UNKNOWN: missing page-load cell/);
  });

  it('rejects zero or identical comparison SHAs before reduction', () => {
    const { baseline, candidate } = bundles();
    assert.throws(
      () =>
        reducePerformanceEvidence(baseline.manifest, candidate.manifest, {
          ...reductionOptions(baseline, candidate),
          expectedCandidateSha: '0'.repeat(40),
        }),
      /nonzero lowercase/
    );
    assert.throws(
      () =>
        reducePerformanceEvidence(baseline.manifest, candidate.manifest, {
          ...reductionOptions(baseline, candidate),
          expectedCandidateSha: BASELINE_SHA,
        }),
      /must be different/
    );
  });

  it('binds the on-disk evidence manifest bytes into the result', () => {
    const { baseline, candidate } = bundles();
    const result = reducePerformanceEvidence(
      baseline.manifest,
      candidate.manifest,
      reductionOptions(baseline, candidate)
    );
    assert.equal(
      result.rawEvidence.baseline.manifestSha256,
      sha256Bytes(readFileSync(baseline.manifestPath))
    );
    assert.equal(
      result.rawEvidence.candidate.manifestSha256,
      sha256Bytes(readFileSync(candidate.manifestPath))
    );
  });
});
