import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAccessibilityCells,
  buildAccessibilityClaimCells,
  buildAccessibilityStateCells,
  loadAccessibilityContract,
  parseAccessibilityRoutes,
  reduceStatuses,
  validateObservationManifest,
  ZERO_GIT_SHA,
  type AccessibilityObservationManifest,
  type AccessibilityResultCell,
} from './accessibility-lib';
import {
  canonicalJson,
  readJson,
  sha256Bytes,
  type GateStatus,
} from './contract-lib';
import { validateJsonSchema } from './json-schema';

type JsonObject = Record<string, unknown>;

const SHA_PATTERN = /^[a-f0-9]{40}$/;

export interface AccessibilityReductionOptions {
  expectedSubjectSha: string;
  expectedEnvironmentId?: string;
  evidenceRoot: string;
}

export interface AccessibilityReduction {
  reductionVersion: 'accessibility-reduction-v1';
  contractId: 'accessibility-v1';
  contractSha256: string;
  subjectSha: string | null;
  environmentId: string | null;
  status: GateStatus;
  resultStatus: GateStatus | null;
  coverageStatus: GateStatus | null;
  errors: string[];
  unknowns: string[];
  summary: {
    expectedLocalCells: number;
    receivedLocalCells: number;
    missingLocalCells: number;
    expectedClaimCells: number;
    receivedClaimCells: number;
    missingClaimCells: number;
    expectedStateCells: number;
    receivedStateCells: number;
    missingStateCells: number;
  };
}

export function accessibilityGatePasses(
  reduction: Pick<AccessibilityReduction, 'status' | 'resultStatus'>
): boolean {
  return reduction.status === 'PASS' && reduction.resultStatus === 'PASS';
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function artifactPath(
  artifact: JsonObject,
  evidenceRoot: string,
  location: string,
  errors: string[]
): string | null {
  if (typeof artifact.path !== 'string' || isAbsolute(artifact.path)) {
    errors.push(`${location}.path must be relative to the evidence root`);
    return null;
  }
  const root = resolve(evidenceRoot);
  const absolute = resolve(root, artifact.path);
  const relativePath = relative(root, absolute);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    errors.push(`${location}.path escapes the evidence root`);
    return null;
  }
  if (!existsSync(absolute)) {
    errors.push(`${location} artifact does not exist: ${artifact.path}`);
    return null;
  }
  if (lstatSync(absolute).isSymbolicLink()) {
    errors.push(`${location} artifact must not be a symbolic link`);
    return null;
  }
  const bytes = readFileSync(absolute);
  if (artifact.bytes !== bytes.byteLength) {
    errors.push(`${location}.bytes does not match the artifact byte count`);
  }
  const digest = sha256Bytes(bytes);
  if (artifact.sha256 !== digest) {
    errors.push(`${location}.sha256 digest mismatch`);
  }
  return absolute;
}

function resultStatus(
  cells: AccessibilityResultCell[],
  stateStatuses: Array<{ required: boolean; status: GateStatus }>,
  claimStatuses: GateStatus[],
  manifest: AccessibilityObservationManifest,
  extendedCoverage: boolean
): GateStatus {
  if (manifest.runnerErrors.length > 0) return 'FAIL';
  const statuses: GateStatus[] = [
    ...(extendedCoverage
      ? cells.map(({ coverageStatus }) => coverageStatus)
      : cells.filter(({ required }) => required).map(({ status }) => status)),
    ...stateStatuses
      .filter(({ required }) => extendedCoverage || required)
      .map(({ status }) => status),
    ...(extendedCoverage ? claimStatuses : []),
  ];
  if (manifest.capabilityBlocks.length > 0) {
    statuses.push('BLOCKED_CAPABILITY');
  }
  return reduceStatuses(statuses);
}

function compareExactCell(
  received: unknown,
  expected: unknown,
  location: string,
  errors: string[]
): void {
  if (canonicalJson(received) !== canonicalJson(expected)) {
    errors.push(`${location} does not match independently reduced evidence`);
  }
}

export function reduceAccessibility(
  value: unknown,
  options: AccessibilityReductionOptions
): AccessibilityReduction {
  const contract = loadAccessibilityContract();
  const errors: string[] = [];
  const unknowns: string[] = [];
  let independentlyReducedStatus: GateStatus | null = null;
  let independentlyReducedCoverageStatus: GateStatus | null = null;
  const routes = parseAccessibilityRoutes(contract);
  const expectedLocalCount =
    routes.length * contract.cells.localRequired.length;
  const expectedClaimCount = contract.cells.claimBoundRequired.length;
  const expectedStateCount = Array.isArray(contract.materiallyDistinctStates)
    ? contract.materiallyDistinctStates.length
    : 0;
  const base = {
    reductionVersion: 'accessibility-reduction-v1' as const,
    contractId: 'accessibility-v1' as const,
    contractSha256: contract.contractSha256,
  };

  if (
    !SHA_PATTERN.test(options.expectedSubjectSha) ||
    options.expectedSubjectSha === ZERO_GIT_SHA
  ) {
    errors.push(
      'expectedSubjectSha must be a nonzero lowercase 40-character Git SHA'
    );
  }

  const schema = readJson(contract.resultSchema);
  errors.push(...validateJsonSchema(value, schema, 'result'));
  if (!isObject(value)) {
    return {
      ...base,
      subjectSha: null,
      environmentId: null,
      status: 'FAIL',
      resultStatus: null,
      coverageStatus: null,
      errors,
      unknowns,
      summary: {
        expectedLocalCells: expectedLocalCount,
        receivedLocalCells: 0,
        missingLocalCells: expectedLocalCount,
        expectedClaimCells: expectedClaimCount,
        receivedClaimCells: 0,
        missingClaimCells: expectedClaimCount,
        expectedStateCells: expectedStateCount,
        receivedStateCells: 0,
        missingStateCells: expectedStateCount,
      },
    };
  }

  const subjectSha =
    typeof value.subjectSha === 'string' ? value.subjectSha : null;
  const environmentId =
    typeof value.environmentId === 'string' ? value.environmentId : null;
  if (value.contractId !== contract.contractId) {
    errors.push('result.contractId does not match accessibility-v1');
  }
  if (value.contractSha256 !== contract.contractSha256) {
    errors.push(
      'result.contractSha256 does not match the exact contract digest'
    );
  }
  if (subjectSha === ZERO_GIT_SHA) {
    errors.push('result.subjectSha must not be the all-zero SHA');
  }
  if (subjectSha !== options.expectedSubjectSha) {
    errors.push('result.subjectSha does not match the expected subject SHA');
  }
  if (
    options.expectedEnvironmentId &&
    environmentId !== options.expectedEnvironmentId
  ) {
    errors.push('result.environmentId does not match the expected environment');
  }

  const artifactValues = Array.isArray(value.artifacts) ? value.artifacts : [];
  const artifactById = new Map<string, JsonObject>();
  const artifactPaths = new Map<string, string>();
  artifactValues.forEach((entry, index) => {
    const location = `result.artifacts[${index}]`;
    if (!isObject(entry) || typeof entry.id !== 'string') return;
    if (artifactById.has(entry.id)) {
      errors.push(`${location}.id duplicates ${entry.id}`);
      return;
    }
    artifactById.set(entry.id, entry);
    const path = artifactPath(entry, options.evidenceRoot, location, errors);
    if (path) artifactPaths.set(entry.id, path);
  });
  const expectedArtifactIds = [
    'route-inventory',
    'route-capabilities',
    'playwright-observations',
    'environment',
  ];
  for (const id of expectedArtifactIds) {
    if (!artifactById.has(id)) errors.push(`result.artifacts is missing ${id}`);
  }
  for (const id of artifactById.keys()) {
    if (!expectedArtifactIds.includes(id)) {
      errors.push(`result.artifacts contains undeclared artifact ${id}`);
    }
  }

  const inventoryArtifact = artifactById.get('route-inventory');
  const routeCapabilitiesArtifact = artifactById.get('route-capabilities');
  const observationArtifact = artifactById.get('playwright-observations');
  const environmentArtifact = artifactById.get('environment');
  const inventoryDigest = inventoryArtifact?.sha256;
  const routeCapabilitiesDigest = routeCapabilitiesArtifact?.sha256;
  const observationDigest = observationArtifact?.sha256;
  const environmentDigest = environmentArtifact?.sha256;
  if (!isObject(value.routeInventory)) {
    errors.push('result.routeInventory must be an object');
  } else {
    if (value.routeInventory.source !== contract.routes.inventory.source) {
      errors.push('result.routeInventory.source does not match the contract');
    }
    if (value.routeInventory.artifactId !== 'route-inventory') {
      errors.push('result.routeInventory.artifactId must be route-inventory');
    }
    if (value.routeInventory.sha256 !== inventoryDigest) {
      errors.push('result.routeInventory.sha256 does not match its artifact');
    }
    if (
      value.routeInventory.capabilityArtifactId !== 'route-capabilities' ||
      value.routeInventory.capabilitySha256 !== routeCapabilitiesDigest
    ) {
      errors.push(
        'result.routeInventory capability artifact binding is invalid'
      );
    }
    if (canonicalJson(value.routeInventory.routes) !== canonicalJson(routes)) {
      errors.push(
        'result.routeInventory.routes does not match the bound route inventory'
      );
    }
  }
  const routeCapabilitiesPath = artifactPaths.get('route-capabilities');
  if (routeCapabilitiesPath) {
    try {
      const capabilityEvidence = JSON.parse(
        readFileSync(routeCapabilitiesPath, 'utf8')
      );
      if (
        capabilityEvidence.capabilityVersion !==
          'accessibility-route-capabilities-v1' ||
        canonicalJson(capabilityEvidence.routes) !== canonicalJson(routes)
      ) {
        errors.push(
          'route capability artifact does not match the independently inspected build'
        );
      }
    } catch (error) {
      errors.push(
        `Cannot parse route capability artifact: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (
    inventoryDigest !==
    sha256Bytes(readFileSync(contract.routes.inventory.source))
  ) {
    errors.push(
      'route inventory artifact digest does not match the contract source'
    );
  }
  if (
    value.evidenceArtifactId !== 'playwright-observations' ||
    value.evidenceArtifactSha256 !== observationDigest
  ) {
    errors.push('result evidence artifact binding is invalid');
  }
  if (
    value.environmentArtifactId !== 'environment' ||
    value.environmentArtifactSha256 !== environmentDigest
  ) {
    errors.push('result environment artifact binding is invalid');
  }

  let manifest: AccessibilityObservationManifest | null = null;
  const observationPath = artifactPaths.get('playwright-observations');
  if (observationPath) {
    try {
      const validated = validateObservationManifest(
        JSON.parse(readFileSync(observationPath, 'utf8')),
        contract,
        routes
      );
      if (!validated.manifest) {
        errors.push(...validated.errors.map((error) => `evidence: ${error}`));
      } else {
        manifest = validated.manifest;
      }
    } catch (error) {
      errors.push(
        `Cannot parse accessibility observation artifact: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const environmentPath = artifactPaths.get('environment');
  if (environmentPath) {
    try {
      const environment = JSON.parse(readFileSync(environmentPath, 'utf8'));
      const exactBindings: Array<[string, unknown]> = [
        ['subjectSha', options.expectedSubjectSha],
        ['environmentId', environmentId],
        ['contractId', contract.contractId],
        ['contractSha256', contract.contractSha256],
        [
          'routeInventorySha256',
          sha256Bytes(readFileSync(contract.routes.inventory.source)),
        ],
        ['routeCapabilitiesSha256', routeCapabilitiesDigest],
      ];
      for (const [field, expected] of exactBindings) {
        if (environment[field] !== expected) {
          errors.push(`environment artifact ${field} binding is invalid`);
        }
      }
      if (environment.playwright !== contract.tools.playwright) {
        errors.push('environment artifact Playwright version is not pinned');
      }
      if (
        !Array.isArray(environment.chromium) ||
        environment.chromium.some(
          (version: unknown) => version !== contract.tools.chromium
        )
      ) {
        errors.push('environment artifact Chromium version is not pinned');
      }
    } catch (error) {
      errors.push(
        `Cannot parse environment artifact: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const receivedCells = Array.isArray(value.cells) ? value.cells : [];
  const receivedClaims = Array.isArray(value.claimCells)
    ? value.claimCells
    : [];
  const receivedStates = Array.isArray(value.stateCells)
    ? value.stateCells
    : [];
  let missingLocalCells = expectedLocalCount;
  let missingClaimCells = expectedClaimCount;
  let missingStateCells = expectedStateCount;

  if (manifest) {
    if (
      value.startedAt !== manifest.startedAt ||
      value.finishedAt !== manifest.finishedAt
    ) {
      errors.push('result timestamps do not match the observation manifest');
    }
    if (
      canonicalJson(value.harnessErrors) !==
      canonicalJson(manifest.runnerErrors)
    ) {
      errors.push(
        'result.harnessErrors does not match the observation manifest'
      );
    }
    if (
      canonicalJson(value.capabilityBlocks) !==
      canonicalJson(manifest.capabilityBlocks)
    ) {
      errors.push(
        'result.capabilityBlocks does not match the observation manifest'
      );
    }

    const expectedCells = buildAccessibilityCells(
      contract,
      routes,
      manifest.observations,
      'playwright-observations'
    );
    const expectedClaims = buildAccessibilityClaimCells(contract);
    const expectedStates = buildAccessibilityStateCells(
      contract,
      routes,
      manifest.observations,
      'playwright-observations'
    );
    const receivedById = new Map<string, unknown>();
    receivedCells.forEach((entry, index) => {
      if (!isObject(entry) || typeof entry.id !== 'string') return;
      if (receivedById.has(entry.id)) {
        errors.push(`result.cells[${index}].id duplicates ${entry.id}`);
      } else {
        receivedById.set(entry.id, entry);
      }
    });
    const expectedIds = new Set(expectedCells.map(({ id }) => id));
    const missingIds = expectedCells
      .filter(({ id }) => !receivedById.has(id))
      .map(({ id }) => id);
    missingLocalCells = missingIds.length;
    if (missingIds.length > 0) {
      unknowns.push(
        `${missingIds.length} required route/oracle cells are missing, including ${missingIds.slice(0, 3).join(', ')}`
      );
    }
    for (const expected of expectedCells) {
      const received = receivedById.get(expected.id);
      if (received !== undefined) {
        compareExactCell(
          received,
          expected,
          `result.cells[${expected.id}]`,
          errors
        );
      }
    }
    for (const id of receivedById.keys()) {
      if (!expectedIds.has(id))
        errors.push(`result.cells contains extra cell ${id}`);
    }

    const receivedClaimById = new Map<string, unknown>();
    receivedClaims.forEach((entry, index) => {
      if (!isObject(entry) || typeof entry.id !== 'string') return;
      if (receivedClaimById.has(entry.id)) {
        errors.push(`result.claimCells[${index}].id duplicates ${entry.id}`);
      } else {
        receivedClaimById.set(entry.id, entry);
      }
    });
    const expectedClaimIds = new Set(expectedClaims.map(({ id }) => id));
    const missingClaims = expectedClaims.filter(
      ({ id }) => !receivedClaimById.has(id)
    );
    missingClaimCells = missingClaims.length;
    if (missingClaims.length > 0) {
      unknowns.push(
        `${missingClaims.length} required claim-bound cells are missing`
      );
    }
    for (const expected of expectedClaims) {
      const received = receivedClaimById.get(expected.id);
      if (received !== undefined) {
        compareExactCell(
          received,
          expected,
          `result.claimCells[${expected.id}]`,
          errors
        );
      }
    }
    for (const id of receivedClaimById.keys()) {
      if (!expectedClaimIds.has(id)) {
        errors.push(`result.claimCells contains extra cell ${id}`);
      }
    }

    const receivedStateById = new Map<string, unknown>();
    receivedStates.forEach((entry, index) => {
      if (!isObject(entry) || typeof entry.id !== 'string') return;
      if (receivedStateById.has(entry.id)) {
        errors.push(`result.stateCells[${index}].id duplicates ${entry.id}`);
      } else {
        receivedStateById.set(entry.id, entry);
      }
    });
    const expectedStateIds = new Set(expectedStates.map(({ id }) => id));
    const missingStates = expectedStates.filter(
      ({ id }) => !receivedStateById.has(id)
    );
    missingStateCells = missingStates.length;
    if (missingStates.length > 0) {
      unknowns.push(
        `${missingStates.length} materially distinct state cells are missing`
      );
    }
    for (const expected of expectedStates) {
      const received = receivedStateById.get(expected.id);
      if (received !== undefined) {
        compareExactCell(
          received,
          expected,
          `result.stateCells[${expected.id}]`,
          errors
        );
      }
    }
    for (const id of receivedStateById.keys()) {
      if (!expectedStateIds.has(id)) {
        errors.push(`result.stateCells contains extra cell ${id}`);
      }
    }
    if (canonicalJson(value.assertedClaims) !== canonicalJson([])) {
      errors.push(
        'result.assertedClaims must be empty until claim-bound device evidence is supplied'
      );
    }

    const expectedStatus = resultStatus(
      expectedCells,
      expectedStates,
      expectedClaims.map(({ status }) => status),
      manifest,
      false
    );
    const expectedCoverageStatus = resultStatus(
      expectedCells,
      expectedStates,
      expectedClaims.map(({ status }) => status),
      manifest,
      true
    );
    independentlyReducedStatus = expectedStatus;
    independentlyReducedCoverageStatus = expectedCoverageStatus;
    if (
      missingIds.length === 0 &&
      missingClaims.length === 0 &&
      missingStates.length === 0
    ) {
      if (value.status !== expectedStatus) {
        errors.push(
          `result.status must be ${expectedStatus}, independently reduced from evidence`
        );
      }
      if (value.coverageStatus !== expectedCoverageStatus) {
        errors.push(
          `result.coverageStatus must be ${expectedCoverageStatus}, independently reduced from all explicit coverage`
        );
      }
    } else if (value.status === 'PASS') {
      errors.push(
        'result.status cannot be PASS while required cells are missing'
      );
    }
  }

  const status: GateStatus =
    errors.length > 0 ? 'FAIL' : unknowns.length > 0 ? 'UNKNOWN' : 'PASS';
  return {
    ...base,
    subjectSha,
    environmentId,
    status,
    resultStatus: independentlyReducedStatus,
    coverageStatus: independentlyReducedCoverageStatus,
    errors,
    unknowns,
    summary: {
      expectedLocalCells: expectedLocalCount,
      receivedLocalCells: receivedCells.length,
      missingLocalCells,
      expectedClaimCells: expectedClaimCount,
      receivedClaimCells: receivedClaims.length,
      missingClaimCells,
      expectedStateCells: expectedStateCount,
      receivedStateCells: receivedStates.length,
      missingStateCells,
    },
  };
}

function parseArguments(argv: string[]): {
  inputPath: string;
  options: AccessibilityReductionOptions;
} {
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
  const expectedSubjectSha =
    values.get('--subject-sha') ?? process.env.QUALITY_SUBJECT_SHA;
  if (!expectedSubjectSha) {
    throw new Error('--subject-sha or QUALITY_SUBJECT_SHA is required');
  }
  const evidenceRoot =
    values.get('--evidence-root') ?? 'test-results/quality/accessibility';
  return {
    inputPath:
      values.get('--input') ?? `${evidenceRoot}/accessibility-result.json`,
    options: {
      expectedSubjectSha,
      expectedEnvironmentId:
        values.get('--environment-id') ?? process.env.QUALITY_ENVIRONMENT_ID,
      evidenceRoot,
    },
  };
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  try {
    const { inputPath, options } = parseArguments(process.argv.slice(2));
    const result = reduceAccessibility(readJson(inputPath), options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!accessibilityGatePasses(result)) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
