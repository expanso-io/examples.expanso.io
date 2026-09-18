import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACCESSIBILITY_RESULT_VERSION,
  buildAccessibilityCells,
  buildAccessibilityClaimCells,
  buildAccessibilityStateCells,
  loadAccessibilityContract,
  parseAccessibilityRoutes,
  reduceStatuses,
  validateObservationManifest,
  ZERO_GIT_SHA,
  type AccessibilityObservationManifest,
} from './accessibility-lib';
import { sha256Bytes, type GateStatus } from './contract-lib';

const SHA_PATTERN = /^[a-f0-9]{40}$/;

interface Artifact {
  id: string;
  kind:
    | 'route-inventory'
    | 'route-capabilities'
    | 'playwright-observations'
    | 'environment';
  path: string;
  bytes: number;
  sha256: string;
  mediaType: string;
}

export interface ProduceAccessibilityResultOptions {
  subjectSha: string;
  environmentId: string;
  observationPath: string;
  evidenceRoot: string;
  outputPath: string;
}

function copyEvidenceFile(
  sourcePath: string,
  evidenceRoot: string,
  targetName: string
): string {
  const source = resolve(sourcePath);
  const target = resolve(evidenceRoot, targetName);
  if (source !== target) copyFileSync(source, target);
  return target;
}

function artifact(
  id: string,
  kind: Artifact['kind'],
  absolutePath: string,
  evidenceRoot: string,
  mediaType: string
): Artifact {
  const path = relative(resolve(evidenceRoot), resolve(absolutePath));
  if (
    path === '' ||
    path === '..' ||
    path.startsWith(`..${sep}`) ||
    path.startsWith('/')
  ) {
    throw new Error(
      `Evidence artifact escapes the evidence root: ${absolutePath}`
    );
  }
  const bytes = readFileSync(absolutePath);
  return {
    id,
    kind,
    path,
    bytes: bytes.byteLength,
    sha256: sha256Bytes(bytes),
    mediaType,
  };
}

function topLevelStatus(
  cellStatuses: GateStatus[],
  harnessErrors: readonly string[],
  capabilityBlocks: readonly string[]
): GateStatus {
  if (harnessErrors.length > 0) return 'FAIL';
  const statuses = [...cellStatuses];
  if (capabilityBlocks.length > 0) statuses.push('BLOCKED_CAPABILITY');
  return reduceStatuses(statuses);
}

export function produceAccessibilityResult(
  options: ProduceAccessibilityResultOptions
): Record<string, unknown> {
  if (
    !SHA_PATTERN.test(options.subjectSha) ||
    options.subjectSha === ZERO_GIT_SHA
  ) {
    throw new Error(
      'subjectSha must be a nonzero lowercase 40-character Git SHA'
    );
  }
  if (!options.environmentId) {
    throw new Error('environmentId must be a non-empty string');
  }
  if (!existsSync(options.observationPath)) {
    throw new Error(
      `Accessibility observation manifest is missing: ${options.observationPath}`
    );
  }

  const contract = loadAccessibilityContract();
  const inventorySource = contract.routes.inventory.source;
  if (!existsSync(inventorySource)) {
    throw new Error(`Required route inventory is missing: ${inventorySource}`);
  }
  const routes = parseAccessibilityRoutes(contract);
  const rawManifest = JSON.parse(readFileSync(options.observationPath, 'utf8'));
  const validated = validateObservationManifest(rawManifest, contract, routes);
  if (!validated.manifest) {
    throw new Error(
      `Accessibility observation manifest is invalid:\n${validated.errors.map((error) => `- ${error}`).join('\n')}`
    );
  }
  const manifest: AccessibilityObservationManifest = validated.manifest;

  const evidenceRoot = resolve(options.evidenceRoot);
  mkdirSync(evidenceRoot, { recursive: true });
  const inventoryCopy = copyEvidenceFile(
    inventorySource,
    evidenceRoot,
    'route-inventory.xml'
  );
  const observationCopy = copyEvidenceFile(
    options.observationPath,
    evidenceRoot,
    'playwright-observations.json'
  );
  const routeCapabilitiesPath = resolve(
    evidenceRoot,
    'route-capabilities.json'
  );
  writeFileSync(
    routeCapabilitiesPath,
    `${JSON.stringify(
      {
        capabilityVersion: 'accessibility-route-capabilities-v1',
        routes,
      },
      null,
      2
    )}\n`
  );
  const environmentPath = resolve(evidenceRoot, 'environment.json');
  const browserVersions = [
    ...new Set(
      manifest.observations.map(({ browserVersion }) => browserVersion)
    ),
  ].sort();
  const environment = {
    environmentVersion: 'accessibility-environment-v1',
    environmentId: options.environmentId,
    subjectSha: options.subjectSha,
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    routeInventorySha256: sha256Bytes(readFileSync(inventorySource)),
    routeCapabilitiesSha256: sha256Bytes(readFileSync(routeCapabilitiesPath)),
    platform: manifest.environment.platform,
    architecture: manifest.environment.architecture,
    node: manifest.environment.node,
    playwright: manifest.environment.playwright,
    chromium: browserVersions,
  };
  writeFileSync(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);

  const artifacts = [
    artifact(
      'route-inventory',
      'route-inventory',
      inventoryCopy,
      evidenceRoot,
      'application/xml'
    ),
    artifact(
      'route-capabilities',
      'route-capabilities',
      routeCapabilitiesPath,
      evidenceRoot,
      'application/json'
    ),
    artifact(
      'playwright-observations',
      'playwright-observations',
      observationCopy,
      evidenceRoot,
      'application/json'
    ),
    artifact(
      'environment',
      'environment',
      environmentPath,
      evidenceRoot,
      'application/json'
    ),
  ];
  const artifactById = new Map(artifacts.map((entry) => [entry.id, entry]));
  const cells = buildAccessibilityCells(
    contract,
    routes,
    manifest.observations,
    'playwright-observations'
  );
  const claimCells = buildAccessibilityClaimCells(contract);
  const stateCells = buildAccessibilityStateCells(
    contract,
    routes,
    manifest.observations,
    'playwright-observations'
  );
  const status = topLevelStatus(
    [
      ...cells.filter((cell) => cell.required).map((cell) => cell.status),
      ...stateCells.filter((cell) => cell.required).map((cell) => cell.status),
    ],
    manifest.runnerErrors,
    manifest.capabilityBlocks
  );
  const coverageStatus = topLevelStatus(
    [
      ...cells.map((cell) => cell.coverageStatus),
      ...stateCells.map((cell) => cell.status),
      ...claimCells.map((cell) => cell.status),
    ],
    manifest.runnerErrors,
    manifest.capabilityBlocks
  );
  const reasons = [
    ...manifest.runnerErrors.map((error) => `Harness error: ${error}`),
    ...manifest.capabilityBlocks.map(
      (reason) => `Blocked browser capability: ${reason}`
    ),
  ];
  if (status !== 'PASS' && reasons.length === 0) {
    reasons.push(
      `${cells.filter((cell) => cell.status !== 'PASS').length} required local route/oracle cells and ${claimCells.length} claim-bound cells are not PASS`
    );
  }
  if (coverageStatus !== 'PASS') {
    reasons.push(
      `Extended coverage status is ${coverageStatus}; runtime, claim-bound, non-applicable, or materially distinct state cells remain explicit`
    );
  }

  const result = {
    resultVersion: ACCESSIBILITY_RESULT_VERSION,
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    subjectSha: options.subjectSha,
    environmentId: options.environmentId,
    startedAt: manifest.startedAt,
    finishedAt: manifest.finishedAt,
    routeInventory: {
      source: inventorySource,
      artifactId: 'route-inventory',
      sha256: artifactById.get('route-inventory')?.sha256,
      capabilityArtifactId: 'route-capabilities',
      capabilitySha256: artifactById.get('route-capabilities')?.sha256,
      routes,
    },
    environmentArtifactId: 'environment',
    environmentArtifactSha256: artifactById.get('environment')?.sha256,
    evidenceArtifactId: 'playwright-observations',
    evidenceArtifactSha256: artifactById.get('playwright-observations')?.sha256,
    artifacts,
    cells,
    stateCells,
    assertedClaims: [],
    claimCells,
    harnessErrors: manifest.runnerErrors,
    capabilityBlocks: manifest.capabilityBlocks,
    status,
    coverageStatus,
    reasons,
  };

  mkdirSync(dirname(resolve(options.outputPath)), { recursive: true });
  writeFileSync(
    resolve(options.outputPath),
    `${JSON.stringify(result, null, 2)}\n`
  );
  return result;
}

function parseArguments(argv: string[]): ProduceAccessibilityResultOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) {
      throw new Error(`Invalid argument sequence near ${key ?? '<end>'}`);
    }
    if (values.has(key)) throw new Error(`${key} was repeated`);
    values.set(key, value);
  }
  const subjectSha =
    values.get('--subject-sha') ?? process.env.QUALITY_SUBJECT_SHA;
  if (!subjectSha)
    throw new Error('--subject-sha or QUALITY_SUBJECT_SHA is required');
  const evidenceRoot =
    values.get('--evidence-root') ?? 'test-results/quality/accessibility';
  return {
    subjectSha,
    environmentId:
      values.get('--environment-id') ??
      process.env.QUALITY_ENVIRONMENT_ID ??
      `${process.platform}-${process.arch}`,
    observationPath:
      values.get('--observations') ??
      `${evidenceRoot}/playwright-observations.json`,
    evidenceRoot,
    outputPath:
      values.get('--output') ?? `${evidenceRoot}/accessibility-result.json`,
  };
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = produceAccessibilityResult(options);
    process.stdout.write(
      `${JSON.stringify({
        resultVersion: result.resultVersion,
        status: result.status,
        output: resolve(options.outputPath),
      })}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
