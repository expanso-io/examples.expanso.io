import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import {
  loadContract,
  percentile,
  readJson,
  sha256Bytes,
  type GateStatus,
  type QualityContract,
} from './contract-lib';
import { validateJsonSchema } from './json-schema';
import {
  productionAssetAttribution,
  type ArtifactRecord,
  type AssetInventory,
  type BrowserMetrics,
  type ClientManifest,
  type PerformanceEvidenceManifest,
} from './performance-evidence';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const ZERO_SHA = '0'.repeat(40);
const RESULT_SCHEMA_ID =
  'https://examples.expanso.io/tests/contracts/schemas/performance-result-v1.schema.json';
const METRIC_NAMES = [
  'sharedJavaScriptGzipBytes',
  'explorerIncrementGzipBytes',
  'globalCssGzipBytes',
  'mobileLcpMsP75',
  'mobileClsP75',
  'mobileInpMsP75',
  'explorerScriptingMsP95',
  'pageOverflowCssPixels',
] as const;

type MetricName = (typeof METRIC_NAMES)[number];
type JsonObject = Record<string, unknown>;

export interface PerformanceMeasurements {
  sharedJavaScriptGzipBytes?: number;
  explorerIncrementGzipBytes?: number;
  globalCssGzipBytes?: number;
  explorerJavaScriptGzipBytes?: number;
  explorerCssGzipBytes?: number;
  mobileLcpMsP75?: number;
  mobileClsP75?: number;
  mobileInpMsP75?: number;
  explorerScriptingMsP95?: number;
  pageOverflowCssPixels?: number;
}

export interface PerformanceComparison {
  metric: MetricName;
  baseline: number;
  candidate: number;
  delta: number;
  threshold: number;
  comparator: '<=' | '<';
  status: 'PASS' | 'FAIL';
}

export interface PerformanceResult {
  resultVersion: '1.0.0';
  contractId: 'performance-v1';
  contractSha256: string;
  baselineSha: string;
  candidateSha: string;
  environmentId: string;
  fixtureIds: string[];
  stageIds: { baseline: string[]; candidate: string[] };
  toolVersions: Record<string, string>;
  timestamps: {
    baselineStartedAt?: string;
    baselineFinishedAt?: string;
    candidateStartedAt?: string;
    candidateFinishedAt?: string;
    reducedAt: string;
  };
  rawTraces: Array<{
    role: 'baseline' | 'candidate';
    id: string;
    path: string;
    bytes: number;
    sha256: string;
  }>;
  rawEvidence: {
    baseline: EvidenceBinding;
    candidate: EvidenceBinding;
  };
  measurements: {
    baseline: PerformanceMeasurements;
    candidate: PerformanceMeasurements;
    comparison: PerformanceComparison[];
  };
  status: GateStatus;
  errors: string[];
}

interface EvidenceBinding {
  manifestPath?: string;
  manifestSha256?: string;
  artifacts: ArtifactRecord[];
}

export interface PerformanceReductionOptions {
  expectedBaselineSha: string;
  expectedCandidateSha: string;
  expectedEnvironmentId: string;
  baselineEvidenceRoot: string;
  candidateEvidenceRoot: string;
  baselineManifestPath: string;
  candidateManifestPath: string;
  now?: Date;
}

interface ValidatedEvidence {
  manifest: PerformanceEvidenceManifest;
  binding: EvidenceBinding;
  measurements: PerformanceMeasurements;
  traces: ArtifactRecord[];
  missing: string[];
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function object(value: unknown, location: string): JsonObject {
  if (!isObject(value)) throw new Error(`${location} must be an object`);
  return value;
}

function finite(value: unknown, location: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${location} must be a nonnegative finite number`);
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameStrings(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort(compareText);
  const sortedRight = [...right].sort(compareText);
  return sortedLeft.every((entry, index) => entry === sortedRight[index]);
}

function validateExpectedSha(value: string, location: string): void {
  if (!SHA_PATTERN.test(value) || value === ZERO_SHA) {
    throw new Error(
      `${location} must be a nonzero lowercase 40-character Git SHA`
    );
  }
}

function artifactPath(
  evidenceRoot: string,
  artifact: ArtifactRecord,
  location: string,
  errors: string[]
): string | null {
  if (isAbsolute(artifact.path)) {
    errors.push(`${location}.path must be relative`);
    return null;
  }
  const root = resolve(evidenceRoot);
  const path = resolve(root, artifact.path);
  const child = relative(root, path);
  if (
    child === '' ||
    child === '..' ||
    child.startsWith(`..${sep}`) ||
    isAbsolute(child)
  ) {
    errors.push(`${location}.path escapes its evidence root`);
    return null;
  }
  if (!existsSync(path) || !statSync(path).isFile()) {
    errors.push(`${location}: artifact does not exist: ${artifact.path}`);
    return null;
  }
  const bytes = readFileSync(path);
  if (bytes.length !== artifact.bytes) {
    errors.push(
      `${location}: byte count mismatch for ${artifact.path}; expected ${artifact.bytes}, got ${bytes.length}`
    );
  }
  const digest = sha256Bytes(bytes);
  if (digest !== artifact.sha256) {
    errors.push(
      `${location}: digest mismatch for ${artifact.path}; expected ${artifact.sha256}, got ${digest}`
    );
  }
  return path;
}

function parseArtifactJson(
  artifact: ArtifactRecord,
  evidenceRoot: string,
  location: string,
  errors: string[]
): unknown | null {
  const path = artifactPath(evidenceRoot, artifact, location, errors);
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(
      `${location}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

function validateAssetInventory(
  inventoryValue: unknown,
  artifacts: Map<string, ArtifactRecord>,
  evidenceRoot: string,
  explorerRoute: string,
  errors: string[]
): PerformanceMeasurements {
  let inventory: AssetInventory;
  try {
    const input = object(inventoryValue, 'asset inventory');
    if (
      input.inventoryVersion !== '1.0.0' ||
      input.attribution !== 'docusaurus-production-chunk-manifest-v1'
    ) {
      throw new Error('asset inventory version or attribution is invalid');
    }
    inventory = input as unknown as AssetInventory;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {};
  }

  const manifestArtifact = (id: string, location: string) => {
    const artifact = artifacts.get(id);
    if (!artifact || artifact.kind !== 'production-manifest') {
      errors.push(`${location} does not reference a production manifest`);
      return null;
    }
    return parseArtifactJson(artifact, evidenceRoot, location, errors);
  };
  const clientManifestValue = manifestArtifact(
    inventory.sourceArtifacts?.clientManifest,
    'asset inventory source clientManifest'
  );
  const routeChunksValue = manifestArtifact(
    inventory.sourceArtifacts?.routeChunks,
    'asset inventory source routeChunks'
  );
  if (!clientManifestValue || !routeChunksValue) return {};

  let expected;
  try {
    expected = productionAssetAttribution(
      clientManifestValue as ClientManifest,
      routeChunksValue as Record<string, Record<string, string>>,
      explorerRoute
    );
  } catch (error) {
    errors.push(
      `asset attribution cannot be reproduced: ${error instanceof Error ? error.message : String(error)}`
    );
    return {};
  }
  if (inventory.explorerRoute !== expected.route) {
    errors.push('asset inventory explorer route mismatch');
  }

  const validateReferences = (
    value: unknown,
    expectedFiles: Array<{ file: string; type: 'js' | 'css' }>,
    type: 'js' | 'css',
    location: string
  ): number => {
    if (!Array.isArray(value)) {
      errors.push(`${location} must be an array`);
      return 0;
    }
    const expectedPaths = expectedFiles
      .filter((asset) => asset.type === type)
      .map((asset) => asset.file)
      .sort(compareText);
    const actualPaths: string[] = [];
    let total = 0;
    for (const [index, rawReference] of value.entries()) {
      try {
        const reference = object(rawReference, `${location}[${index}]`);
        const artifactId = String(reference.artifactId);
        const artifact = artifacts.get(artifactId);
        if (!artifact || artifact.kind !== 'production-asset') {
          throw new Error(
            `${location}[${index}] does not reference a production asset`
          );
        }
        const path = artifactPath(
          evidenceRoot,
          artifact,
          `${location}[${index}]`,
          errors
        );
        if (!path) continue;
        const sourceFile = String(reference.sourceFile);
        actualPaths.push(sourceFile);
        if (reference.sha256 !== artifact.sha256) {
          errors.push(`${location}[${index}] digest does not match artifact`);
        }
        const gzipBytes = gzipSync(readFileSync(path), { level: 9 }).length;
        if (reference.gzipBytes !== gzipBytes) {
          errors.push(
            `${location}[${index}] gzip size mismatch; expected ${reference.gzipBytes}, got ${gzipBytes}`
          );
        }
        total += gzipBytes;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (!sameStrings(actualPaths, expectedPaths)) {
      errors.push(
        `${location} does not exactly match production chunk attribution`
      );
    }
    return total;
  };

  const shared = object(inventory.shared, 'asset inventory shared');
  const explorer = object(inventory.explorer, 'asset inventory explorer');
  const sharedJavaScriptGzipBytes = validateReferences(
    shared.javascript,
    expected.sharedFiles,
    'js',
    'asset inventory shared.javascript'
  );
  const globalCssGzipBytes = validateReferences(
    shared.css,
    expected.sharedFiles,
    'css',
    'asset inventory shared.css'
  );
  const explorerJavaScriptGzipBytes = validateReferences(
    explorer.javascript,
    expected.explorerFiles,
    'js',
    'asset inventory explorer.javascript'
  );
  const explorerCssGzipBytes = validateReferences(
    explorer.css,
    expected.explorerFiles,
    'css',
    'asset inventory explorer.css'
  );
  return {
    sharedJavaScriptGzipBytes,
    globalCssGzipBytes,
    explorerJavaScriptGzipBytes,
    explorerCssGzipBytes,
    explorerIncrementGzipBytes:
      explorerJavaScriptGzipBytes + explorerCssGzipBytes,
  };
}

function validateBrowserMetrics(
  value: unknown,
  manifest: PerformanceEvidenceManifest,
  contract: QualityContract,
  artifacts: Map<string, ArtifactRecord>,
  missing: string[],
  errors: string[]
): PerformanceMeasurements {
  let metrics: BrowserMetrics;
  try {
    const input = object(value, 'browser metrics');
    if (input.metricsVersion !== '1.0.0') {
      throw new Error('browser metrics version must be 1.0.0');
    }
    if (input.subjectSha !== manifest.subjectSha) {
      throw new Error('browser metrics subjectSha mismatch');
    }
    if (input.contractSha256 !== manifest.contractSha256) {
      throw new Error('browser metrics contract digest mismatch');
    }
    metrics = input as unknown as BrowserMetrics;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {};
  }

  const requiredRoutes = contract.routes.required.filter(
    (route) => route.availableWhen === undefined
  );
  const profiles = Object.keys(object(contract.profiles, 'contract profiles'));
  const themes = contract.themes as string[];
  const runs = object(contract.runs, 'contract runs');
  const pageLoadsPerCell = Number(runs.pageLoadsPerCell);
  const expectedCellIds = new Set(
    requiredRoutes.flatMap((route) =>
      profiles.flatMap((profileId) =>
        themes.map((theme) => `${route.id}|${profileId}|${theme}`)
      )
    )
  );
  const cells = Array.isArray(metrics.pageLoadCells)
    ? metrics.pageLoadCells
    : [];
  const actualCellIds = new Set<string>();
  const mobileLcp: number[] = [];
  const mobileCls: number[] = [];
  const overflows: number[] = [];
  for (const [index, cell] of cells.entries()) {
    const id = `${cell.routeId}|${cell.profileId}|${cell.theme}`;
    if (actualCellIds.has(id)) errors.push(`duplicate page-load cell ${id}`);
    actualCellIds.add(id);
    if (!expectedCellIds.has(id))
      errors.push(`unexpected page-load cell ${id}`);
    if (cell.cacheMode !== 'cold-page-load') {
      errors.push(`${id}: cacheMode must be cold-page-load`);
    }
    if (!Array.isArray(cell.runs) || cell.runs.length !== pageLoadsPerCell) {
      missing.push(
        `${id}: expected ${pageLoadsPerCell} page-load runs, got ${cell.runs?.length ?? 0}`
      );
      continue;
    }
    const trace = artifacts.get(cell.traceArtifactId);
    if (!trace || trace.kind !== 'playwright-trace') {
      errors.push(`${id}: trace artifact is missing or has the wrong kind`);
    }
    try {
      const lcp = cell.runs.map((run, runIndex) =>
        finite(run.lcpMs, `${id}.runs[${runIndex}].lcpMs`)
      );
      const cls = cell.runs.map((run, runIndex) =>
        finite(run.cls, `${id}.runs[${runIndex}].cls`)
      );
      for (const [runIndex, run] of cell.runs.entries()) {
        overflows.push(
          finite(
            run.overflowCssPixels,
            `${id}.runs[${runIndex}].overflowCssPixels`
          )
        );
      }
      if (cell.profileId === 'mobile') {
        mobileLcp.push(percentile(lcp, 0.75));
        mobileCls.push(percentile(cls, 0.75));
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const id of expectedCellIds) {
    if (!actualCellIds.has(id)) missing.push(`missing page-load cell ${id}`);
  }

  const lighthouseCells = Array.isArray(metrics.lighthouseCells)
    ? metrics.lighthouseCells
    : [];
  const lighthouseRoutes = new Set<string>();
  for (const cell of lighthouseCells) {
    lighthouseRoutes.add(cell.routeId);
    try {
      finite(cell.lcpMs, `lighthouse ${cell.routeId}.lcpMs`);
      finite(cell.cls, `lighthouse ${cell.routeId}.cls`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    const report = artifacts.get(cell.reportArtifactId);
    if (!report || report.kind !== 'lighthouse-report') {
      errors.push(
        `lighthouse ${cell.routeId}: report artifact is missing or has the wrong kind`
      );
    }
  }
  for (const route of requiredRoutes) {
    if (!lighthouseRoutes.has(String(route.id))) {
      missing.push(`missing Lighthouse evidence for ${route.id}`);
    }
  }

  const explorer = metrics.explorer;
  if (!explorer || typeof explorer !== 'object') {
    missing.push('missing Explorer interaction metrics');
    return {};
  }
  if (!sameStrings(explorer.stageIds ?? [], manifest.stageIds)) {
    errors.push('Explorer stage ids do not match the evidence manifest');
  }
  if (explorer.warmups !== Number(runs.explorerWarmups)) {
    missing.push(
      `Explorer warmup count must be ${runs.explorerWarmups}, got ${explorer.warmups}`
    );
  }
  if (
    explorer.measuredTransitions !== Number(runs.explorerMeasuredTransitions) ||
    explorer.scriptingMs?.length !== Number(runs.explorerMeasuredTransitions)
  ) {
    missing.push(
      `Explorer must contain ${runs.explorerMeasuredTransitions} measured transitions`
    );
  }
  const explorerTrace = artifacts.get(explorer.traceArtifactId);
  if (!explorerTrace || explorerTrace.kind !== 'playwright-trace') {
    errors.push('Explorer trace artifact is missing or has the wrong kind');
  }
  if (
    !Array.isArray(explorer.eventDurationsMs) ||
    explorer.eventDurationsMs.length === 0
  ) {
    missing.push('Explorer INP event-duration evidence is missing');
  }

  const result: PerformanceMeasurements = {};
  if (mobileLcp.length > 0) result.mobileLcpMsP75 = Math.max(...mobileLcp);
  if (mobileCls.length > 0) result.mobileClsP75 = Math.max(...mobileCls);
  if (overflows.length > 0)
    result.pageOverflowCssPixels = Math.max(...overflows);
  try {
    if (explorer.eventDurationsMs?.length) {
      result.mobileInpMsP75 = percentile(
        explorer.eventDurationsMs.map((entry, index) =>
          finite(entry, `Explorer eventDurationsMs[${index}]`)
        ),
        0.75
      );
    }
    if (explorer.scriptingMs?.length) {
      result.explorerScriptingMsP95 = percentile(
        explorer.scriptingMs.map((entry, index) =>
          finite(entry, `Explorer scriptingMs[${index}]`)
        ),
        0.95
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}

function validateEvidence(
  input: unknown,
  role: 'baseline' | 'candidate',
  contract: QualityContract,
  options: PerformanceReductionOptions,
  errors: string[]
): ValidatedEvidence | null {
  const evidenceRoot =
    role === 'baseline'
      ? options.baselineEvidenceRoot
      : options.candidateEvidenceRoot;
  const manifestPath =
    role === 'baseline'
      ? options.baselineManifestPath
      : options.candidateManifestPath;
  const expectedSha =
    role === 'baseline'
      ? options.expectedBaselineSha
      : options.expectedCandidateSha;
  if (input === undefined || input === null) {
    errors.push(`${role}: missing evidence manifest`);
    return null;
  }

  const evidenceSchema = readJson(resolve(String(contract.evidenceSchema)));
  const schemaErrors = validateJsonSchema(
    input,
    evidenceSchema,
    `${role} evidence`
  );
  if (schemaErrors.length > 0) {
    errors.push(...schemaErrors);
    return null;
  }
  const manifest = input as PerformanceEvidenceManifest;
  if (manifest.role !== role) errors.push(`${role}: evidence role mismatch`);
  if (manifest.contractId !== contract.contractId) {
    errors.push(`${role}: contractId mismatch`);
  }
  if (manifest.contractSha256 !== contract.contractSha256) {
    errors.push(`${role}: contract digest mismatch`);
  }
  if (manifest.subjectSha === ZERO_SHA || manifest.subjectSha !== expectedSha) {
    errors.push(
      `${role}: subjectSha mismatch; expected ${expectedSha}, got ${manifest.subjectSha}`
    );
  }
  if (manifest.environmentId !== options.expectedEnvironmentId) {
    errors.push(
      `${role}: environmentId mismatch; expected ${options.expectedEnvironmentId}, got ${manifest.environmentId}`
    );
  }

  const freshness = object(contract.evidenceFreshness, 'evidenceFreshness');
  const startedAt = new Date(manifest.startedAt);
  const finishedAt = new Date(manifest.finishedAt);
  const now = options.now ?? new Date();
  if (finishedAt <= startedAt) {
    errors.push(`${role}: finishedAt must be later than startedAt`);
  }
  const maxAgeMs = Number(freshness.maxAgeMinutes) * 60_000;
  const futureSkewMs = Number(freshness.maxFutureSkewMinutes) * 60_000;
  if (now.valueOf() - finishedAt.valueOf() > maxAgeMs) {
    errors.push(`${role}: evidence is stale`);
  }
  if (finishedAt.valueOf() > now.valueOf() + futureSkewMs) {
    errors.push(`${role}: evidence timestamp is too far in the future`);
  }

  const expectedFixtures = contract.fixtures.map((fixture) => fixture.id);
  if (!sameStrings(manifest.fixtureIds, expectedFixtures)) {
    errors.push(`${role}: fixtureIds do not exactly match the contract`);
  }
  for (const [tool, version] of Object.entries(contract.tools)) {
    if (manifest.toolVersions[tool] !== version) {
      errors.push(
        `${role}: tool version mismatch for ${tool}; expected ${version}, got ${manifest.toolVersions[tool]}`
      );
    }
  }
  if (
    !sameStrings(
      Object.keys(manifest.toolVersions),
      Object.keys(contract.tools)
    )
  ) {
    errors.push(`${role}: toolVersions keys do not exactly match the contract`);
  }
  if (
    manifest.capability.status === 'BLOCKED_CAPABILITY' &&
    !manifest.capability.reason
  ) {
    errors.push(`${role}: blocked capability evidence requires a reason`);
  }

  const binding: EvidenceBinding = { artifacts: manifest.artifacts };
  const absoluteManifestPath = resolve(manifestPath);
  const root = resolve(evidenceRoot);
  const manifestRelative = relative(root, absoluteManifestPath);
  if (
    manifestRelative === '' ||
    manifestRelative === '..' ||
    manifestRelative.startsWith(`..${sep}`) ||
    isAbsolute(manifestRelative) ||
    !existsSync(absoluteManifestPath)
  ) {
    errors.push(
      `${role}: evidence manifest path is missing or outside its root`
    );
  } else {
    const manifestBytes = readFileSync(absoluteManifestPath);
    binding.manifestPath = `${role}/${manifestRelative.split(sep).join('/')}`;
    binding.manifestSha256 = sha256Bytes(manifestBytes);
    try {
      const manifestOnDisk = JSON.parse(manifestBytes.toString('utf8'));
      if (JSON.stringify(manifestOnDisk) !== JSON.stringify(input)) {
        errors.push(`${role}: in-memory evidence differs from manifest bytes`);
      }
    } catch {
      errors.push(`${role}: evidence manifest is not valid JSON`);
    }
  }

  const artifacts = new Map<string, ArtifactRecord>();
  const artifactPaths = new Set<string>();
  for (const [index, artifact] of manifest.artifacts.entries()) {
    if (artifacts.has(artifact.id))
      errors.push(`${role}: duplicate artifact id ${artifact.id}`);
    if (artifactPaths.has(artifact.path))
      errors.push(`${role}: duplicate artifact path ${artifact.path}`);
    artifacts.set(artifact.id, artifact);
    artifactPaths.add(artifact.path);
    artifactPath(evidenceRoot, artifact, `${role}.artifacts[${index}]`, errors);
  }
  const byKind = (kind: ArtifactRecord['kind']) =>
    manifest.artifacts.filter((artifact) => artifact.kind === kind);
  const inventoryArtifacts = byKind('asset-inventory');
  const metricsArtifacts = byKind('browser-metrics');
  const traceArtifacts = byKind('playwright-trace');
  if (manifest.capability.status === 'AVAILABLE') {
    if (manifest.stageIds.length === 0) {
      errors.push(
        `${role}: stageIds evidence is required when the browser is available`
      );
    }
    if (inventoryArtifacts.length !== 1) {
      errors.push(`${role}: exactly one asset-inventory artifact is required`);
    }
    if (metricsArtifacts.length !== 1) {
      errors.push(`${role}: exactly one browser-metrics artifact is required`);
    }
    if (traceArtifacts.length === 0) {
      errors.push(`${role}: raw Playwright traces are required`);
    }
    if (byKind('lighthouse-report').length === 0) {
      errors.push(`${role}: raw Lighthouse reports are required`);
    }
  }

  const missing: string[] = [];
  let measurements: PerformanceMeasurements = {};
  if (inventoryArtifacts.length === 1) {
    const inventory = parseArtifactJson(
      inventoryArtifacts[0],
      evidenceRoot,
      `${role} asset inventory`,
      errors
    );
    measurements = {
      ...measurements,
      ...validateAssetInventory(
        inventory,
        artifacts,
        evidenceRoot,
        String(
          (
            contract.routes.required.find(
              (route) => route.id === 'remove-pii-pilot'
            ) ?? {}
          ).path
        ),
        errors
      ),
    };
  }
  if (metricsArtifacts.length === 1) {
    const metrics = parseArtifactJson(
      metricsArtifacts[0],
      evidenceRoot,
      `${role} browser metrics`,
      errors
    );
    measurements = {
      ...measurements,
      ...validateBrowserMetrics(
        metrics,
        manifest,
        contract,
        artifacts,
        missing,
        errors
      ),
    };
  }

  return {
    manifest,
    binding,
    measurements,
    traces: traceArtifacts,
    missing,
  };
}

function thresholdFor(
  metric: MetricName,
  contract: QualityContract
): { threshold: number; comparator: '<=' | '<' } {
  const thresholds = object(contract.thresholds, 'thresholds');
  const mapping: Record<MetricName, { field: string; comparator: '<=' | '<' }> =
    {
      sharedJavaScriptGzipBytes: {
        field: 'sharedJavaScriptGzipBytes',
        comparator: '<=',
      },
      explorerIncrementGzipBytes: {
        field: 'explorerIncrementGzipBytes',
        comparator: '<=',
      },
      globalCssGzipBytes: { field: 'globalCssGzipBytes', comparator: '<=' },
      mobileLcpMsP75: { field: 'mobileLcpMsP75', comparator: '<=' },
      mobileClsP75: { field: 'mobileClsP75Exclusive', comparator: '<' },
      mobileInpMsP75: { field: 'mobileInpMsP75', comparator: '<=' },
      explorerScriptingMsP95: {
        field: 'explorerScriptingMsP95Exclusive',
        comparator: '<',
      },
      pageOverflowCssPixels: {
        field: 'pageOverflowCssPixels',
        comparator: '<=',
      },
    };
  const definition = mapping[metric];
  return {
    threshold: Number(thresholds[definition.field]),
    comparator: definition.comparator,
  };
}

export function reducePerformanceEvidence(
  baselineInput: unknown,
  candidateInput: unknown,
  options: PerformanceReductionOptions
): PerformanceResult {
  validateExpectedSha(options.expectedBaselineSha, 'expectedBaselineSha');
  validateExpectedSha(options.expectedCandidateSha, 'expectedCandidateSha');
  if (options.expectedBaselineSha === options.expectedCandidateSha) {
    throw new Error('baseline and candidate SHAs must be different');
  }
  if (!options.expectedEnvironmentId) {
    throw new Error('expectedEnvironmentId must be non-empty');
  }
  const contract = loadContract('tests/contracts/performance-v1.json');
  const now = options.now ?? new Date();
  const errors: string[] = [];
  const schemaBindings = object(contract.schemaBindings, 'schemaBindings');
  for (const [bindingId, expectedPath] of Object.entries({
    evidence: String(contract.evidenceSchema),
    result: contract.resultSchema,
  })) {
    try {
      const binding = object(
        schemaBindings[bindingId],
        `schemaBindings.${bindingId}`
      );
      if (binding.path !== expectedPath) {
        errors.push(`schemaBindings.${bindingId}.path mismatch`);
      }
      const actualDigest = sha256Bytes(readFileSync(resolve(expectedPath)));
      if (binding.sha256 !== actualDigest) {
        errors.push(`schemaBindings.${bindingId}.sha256 mismatch`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const baseline = validateEvidence(
    baselineInput,
    'baseline',
    contract,
    options,
    errors
  );
  const candidate = validateEvidence(
    candidateInput,
    'candidate',
    contract,
    options,
    errors
  );

  const comparison: PerformanceComparison[] = [];
  const missing: string[] = [
    ...(baseline?.missing ?? []),
    ...(candidate?.missing ?? []),
  ];
  for (const metric of METRIC_NAMES) {
    const baselineValue = baseline?.measurements[metric];
    const candidateValue = candidate?.measurements[metric];
    if (baselineValue === undefined || candidateValue === undefined) {
      missing.push(
        `${metric}: baseline and candidate measurements are required`
      );
      continue;
    }
    const { threshold, comparator } = thresholdFor(metric, contract);
    const passes =
      comparator === '<'
        ? candidateValue < threshold
        : candidateValue <= threshold;
    comparison.push({
      metric,
      baseline: baselineValue,
      candidate: candidateValue,
      delta: candidateValue - baselineValue,
      threshold,
      comparator,
      status: passes ? 'PASS' : 'FAIL',
    });
    if (!passes) {
      errors.push(
        `${metric}: candidate ${candidateValue} must be ${comparator} ${threshold}`
      );
    }
  }

  const capabilityBlocked = [baseline, candidate].some(
    (entry) => entry?.manifest.capability.status === 'BLOCKED_CAPABILITY'
  );
  let status: GateStatus;
  if (errors.length > 0) status = 'FAIL';
  else if (capabilityBlocked) status = 'BLOCKED_CAPABILITY';
  else if (missing.length > 0) status = 'UNKNOWN';
  else status = 'PASS';

  const result: PerformanceResult = {
    resultVersion: '1.0.0',
    contractId: 'performance-v1',
    contractSha256: contract.contractSha256,
    baselineSha: options.expectedBaselineSha,
    candidateSha: options.expectedCandidateSha,
    environmentId: options.expectedEnvironmentId,
    fixtureIds: contract.fixtures.map((fixture) => fixture.id),
    stageIds: {
      baseline: baseline?.manifest.stageIds ?? [],
      candidate: candidate?.manifest.stageIds ?? [],
    },
    toolVersions: { ...contract.tools },
    timestamps: {
      ...(baseline
        ? {
            baselineStartedAt: baseline.manifest.startedAt,
            baselineFinishedAt: baseline.manifest.finishedAt,
          }
        : {}),
      ...(candidate
        ? {
            candidateStartedAt: candidate.manifest.startedAt,
            candidateFinishedAt: candidate.manifest.finishedAt,
          }
        : {}),
      reducedAt: now.toISOString(),
    },
    rawTraces: [
      ...(baseline?.traces ?? []).map((artifact) => ({
        role: 'baseline' as const,
        id: artifact.id,
        path: `baseline/${artifact.path}`,
        bytes: artifact.bytes,
        sha256: artifact.sha256,
      })),
      ...(candidate?.traces ?? []).map((artifact) => ({
        role: 'candidate' as const,
        id: artifact.id,
        path: `candidate/${artifact.path}`,
        bytes: artifact.bytes,
        sha256: artifact.sha256,
      })),
    ],
    rawEvidence: {
      baseline: baseline?.binding ?? { artifacts: [] },
      candidate: candidate?.binding ?? { artifacts: [] },
    },
    measurements: {
      baseline: baseline?.measurements ?? {},
      candidate: candidate?.measurements ?? {},
      comparison,
    },
    status,
    errors: [...errors, ...missing.map((entry) => `UNKNOWN: ${entry}`)],
  };

  const resultSchema = readJson(resolve(contract.resultSchema));
  const schema = object(resultSchema, 'performance result schema');
  if (schema.$id !== RESULT_SCHEMA_ID) {
    result.status = 'FAIL';
    result.errors.push(`result schema $id must be ${RESULT_SCHEMA_ID}`);
  }
  const resultSchemaErrors = validateJsonSchema(result, schema, 'result');
  if (resultSchemaErrors.length > 0) {
    result.status = 'FAIL';
    result.errors.push(...resultSchemaErrors);
  }
  return result;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}

function main(): void {
  const baselineManifestPath = resolve(requiredArgument('--baseline'));
  const candidateManifestPath = resolve(requiredArgument('--candidate'));
  const outputPath = resolve(requiredArgument('--output'));
  const baselineEvidenceRoot = resolve(
    argument('--baseline-root') ?? resolve(baselineManifestPath, '..')
  );
  const candidateEvidenceRoot = resolve(
    argument('--candidate-root') ?? resolve(candidateManifestPath, '..')
  );
  const result = reducePerformanceEvidence(
    readJson(baselineManifestPath),
    readJson(candidateManifestPath),
    {
      expectedBaselineSha: requiredArgument('--baseline-sha'),
      expectedCandidateSha: requiredArgument('--candidate-sha'),
      expectedEnvironmentId: requiredArgument('--environment-id'),
      baselineEvidenceRoot,
      candidateEvidenceRoot,
      baselineManifestPath,
      candidateManifestPath,
    }
  );
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: result.status,
      baselineSha: result.baselineSha,
      candidateSha: result.candidateSha,
      contractSha256: result.contractSha256,
      output: outputPath,
      errors: result.errors,
    })
  );
  if (result.status !== 'PASS') process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();
