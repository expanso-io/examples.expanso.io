import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

import {
  loadContract,
  type GateStatus,
  type QualityContract,
} from './contract-lib';

export const ACCESSIBILITY_RESULT_VERSION = '1.0.0';
export const ACCESSIBILITY_OBSERVATION_VERSION = '1.0.0';
export const ZERO_GIT_SHA = '0'.repeat(40);

export interface AccessibilityContract extends QualityContract {
  contractId: 'accessibility-v1';
  environments: Array<{
    id: string;
    width: number;
    height: number;
    deviceScaleFactor: number;
  }>;
  themes: string[];
  interactionModes: string[];
  unavailableInteractionModes: Array<{
    id: string;
    status: 'BLOCKED_CAPABILITY';
    reason: string;
  }>;
  unavailableStates: Array<{
    id: string;
    status: 'BLOCKED_CAPABILITY';
    reason: string;
  }>;
  materiallyDistinctStates: string[];
  cells: {
    localRequired: Array<{
      id: string;
      oracle: string;
      requiredCoverage: {
        environments: string[];
        themes: string[];
        interactionModes: string[];
        routeCapability: 'all' | 'explorer-v2';
      };
    }>;
    claimBoundRequired: Array<{
      id: string;
      claim: string;
      unavailable: 'BLOCKED_CAPABILITY';
    }>;
  };
}

export interface InventoryRoute {
  id: string;
  path: string;
  capabilities: {
    explorerV2: boolean;
  };
}

export interface AccessibilityObservation {
  observationVersion: typeof ACCESSIBILITY_OBSERVATION_VERSION;
  oracleId: string;
  routePath: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'BLOCKED_CAPABILITY';
  environmentIds: string[];
  themes: string[];
  interactionModes: string[];
  stateIds: string[];
  browserVersion: string;
  projectName: string;
  durationMs: number;
  reasons: string[];
}

export interface AccessibilityObservationManifest {
  manifestVersion: 'accessibility-observations-v1';
  startedAt: string;
  finishedAt: string;
  environment: {
    platform: string;
    architecture: string;
    node: string;
    playwright: string;
  };
  observations: AccessibilityObservation[];
  runnerErrors: string[];
  capabilityBlocks: string[];
}

export interface CoverageCell {
  id: string;
  status: GateStatus;
  reasons: string[];
  evidenceArtifactIds: string[];
}

export interface AccessibilityResultCell {
  id: string;
  oracleId: string;
  routeId: string;
  routePath: string;
  applicable: boolean;
  required: boolean;
  status: GateStatus;
  coverageStatus: GateStatus;
  reasons: string[];
  evidenceArtifactIds: string[];
  coverage: {
    environments: CoverageCell[];
    themes: CoverageCell[];
    interactionModes: CoverageCell[];
  };
}

export interface AccessibilityClaimCell {
  id: string;
  claim: string;
  required: false;
  status: 'BLOCKED_CAPABILITY';
  reasons: string[];
  evidenceArtifactIds: string[];
}

export interface AccessibilityStateCell {
  id: string;
  required: boolean;
  status: GateStatus;
  reasons: string[];
  evidenceArtifactIds: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = new Date(value);
  return (
    Number.isFinite(timestamp.valueOf()) && timestamp.toISOString() === value
  );
}

function stringArray(
  value: unknown,
  location: string,
  errors: string[]
): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    errors.push(`${location} must be an array of non-empty strings`);
    return [];
  }
  if (new Set(value).size !== value.length) {
    errors.push(`${location} must contain unique values`);
  }
  return value as string[];
}

export function validateObservationManifest(
  value: unknown,
  contract: AccessibilityContract,
  routes: readonly InventoryRoute[]
): { manifest: AccessibilityObservationManifest | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(value)) {
    return {
      manifest: null,
      errors: ['observation manifest must be an object'],
    };
  }
  if (value.manifestVersion !== 'accessibility-observations-v1') {
    errors.push(
      'observation manifest manifestVersion must be accessibility-observations-v1'
    );
  }
  if (!isCanonicalTimestamp(value.startedAt)) {
    errors.push('observation manifest startedAt must be a canonical timestamp');
  }
  if (!isCanonicalTimestamp(value.finishedAt)) {
    errors.push(
      'observation manifest finishedAt must be a canonical timestamp'
    );
  }
  if (
    isCanonicalTimestamp(value.startedAt) &&
    isCanonicalTimestamp(value.finishedAt) &&
    new Date(value.finishedAt) < new Date(value.startedAt)
  ) {
    errors.push('observation manifest finishedAt must not precede startedAt');
  }
  if (!isObject(value.environment)) {
    errors.push('observation manifest environment must be an object');
  } else {
    for (const field of ['platform', 'architecture', 'node', 'playwright']) {
      if (
        typeof value.environment[field] !== 'string' ||
        value.environment[field].length === 0
      ) {
        errors.push(`observation manifest environment.${field} is required`);
      }
    }
    if (value.environment.playwright !== contract.tools.playwright) {
      errors.push(
        `observation Playwright version mismatch: expected ${contract.tools.playwright}, received ${String(value.environment.playwright)}`
      );
    }
  }

  const routePaths = new Set(routes.map(({ path }) => path));
  const oracleIds = new Set(contract.cells.localRequired.map(({ id }) => id));
  const environmentIds = new Set(contract.environments.map(({ id }) => id));
  const themeIds = new Set(contract.themes);
  const modeIds = new Set(contract.interactionModes);
  const stateIds = new Set(
    Array.isArray(contract.materiallyDistinctStates)
      ? contract.materiallyDistinctStates.filter(
          (entry): entry is string => typeof entry === 'string'
        )
      : []
  );
  const observations = Array.isArray(value.observations)
    ? value.observations
    : [];
  if (!Array.isArray(value.observations)) {
    errors.push('observation manifest observations must be an array');
  }
  const observationKeys = new Set<string>();

  observations.forEach((entry, index) => {
    const location = `observations[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${location} must be an object`);
      return;
    }
    if (entry.observationVersion !== ACCESSIBILITY_OBSERVATION_VERSION) {
      errors.push(`${location}.observationVersion must be 1.0.0`);
    }
    if (typeof entry.oracleId !== 'string' || !oracleIds.has(entry.oracleId)) {
      errors.push(`${location}.oracleId is not declared by the contract`);
    }
    if (
      typeof entry.routePath !== 'string' ||
      !routePaths.has(entry.routePath)
    ) {
      errors.push(`${location}.routePath is not in the bound route inventory`);
    }
    if (
      !['PASS', 'FAIL', 'UNKNOWN', 'BLOCKED_CAPABILITY'].includes(
        String(entry.status)
      )
    ) {
      errors.push(`${location}.status is invalid`);
    }
    const dimensions: Array<[string, unknown, ReadonlySet<string>]> = [
      ['environmentIds', entry.environmentIds, environmentIds],
      ['themes', entry.themes, themeIds],
      ['interactionModes', entry.interactionModes, modeIds],
    ];
    for (const [field, fieldValue, allowed] of dimensions) {
      const ids = stringArray(fieldValue, `${location}.${field}`, errors);
      if (ids.length === 0) {
        errors.push(`${location}.${field} must cover at least one value`);
      }
      for (const id of ids) {
        if (!allowed.has(id)) {
          errors.push(`${location}.${field} contains undeclared value ${id}`);
        }
      }
    }
    const observedStateIds = stringArray(
      entry.stateIds,
      `${location}.stateIds`,
      errors
    );
    for (const id of observedStateIds) {
      if (!stateIds.has(id)) {
        errors.push(`${location}.stateIds contains undeclared value ${id}`);
      }
    }
    if (
      typeof entry.browserVersion !== 'string' ||
      entry.browserVersion !== contract.tools.chromium
    ) {
      errors.push(
        `${location}.browserVersion must match pinned Chromium ${contract.tools.chromium}`
      );
    }
    if (
      typeof entry.projectName !== 'string' ||
      entry.projectName.length === 0
    ) {
      errors.push(`${location}.projectName is required`);
    }
    if (
      typeof entry.durationMs !== 'number' ||
      !Number.isFinite(entry.durationMs) ||
      entry.durationMs < 0
    ) {
      errors.push(`${location}.durationMs must be a non-negative number`);
    }
    const reasons = stringArray(entry.reasons, `${location}.reasons`, errors);
    if (entry.status === 'PASS' && reasons.length !== 0) {
      errors.push(`${location}.reasons must be empty for PASS`);
    }
    if (entry.status !== 'PASS' && reasons.length === 0) {
      errors.push(`${location}.reasons must explain non-PASS status`);
    }

    const key = JSON.stringify([
      entry.routePath,
      entry.oracleId,
      entry.environmentIds,
      entry.themes,
      entry.interactionModes,
      entry.stateIds,
      entry.projectName,
    ]);
    if (observationKeys.has(key)) {
      errors.push(`${location} duplicates an earlier observation`);
    }
    observationKeys.add(key);
  });

  stringArray(value.runnerErrors, 'runnerErrors', errors);
  stringArray(value.capabilityBlocks, 'capabilityBlocks', errors);

  return {
    manifest:
      errors.length === 0
        ? (value as unknown as AccessibilityObservationManifest)
        : null,
    errors,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function accessibilityRouteId(path: string): string {
  return `route-${sha256(path)}`;
}

export function accessibilityCellId(routeId: string, oracleId: string): string {
  return `${routeId}::${oracleId}`;
}

export function loadAccessibilityContract(): AccessibilityContract {
  const contract = loadContract(
    'tests/contracts/accessibility-v1.json'
  ) as AccessibilityContract;
  if (contract.contractId !== 'accessibility-v1') {
    throw new Error(
      `Expected accessibility-v1, received ${contract.contractId}`
    );
  }
  return contract;
}

function normalizeRoutePath(rawPath: string): string {
  if (!rawPath.startsWith('/')) {
    throw new Error(`Inventory route must start with /: ${rawPath}`);
  }
  return rawPath === '/' || rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
}

export function parseSitemapRoutes(path: string): InventoryRoute[] {
  const xml = readFileSync(path, 'utf8');
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    let url: URL;
    try {
      url = new URL(match[1]);
    } catch {
      throw new Error(`Invalid sitemap URL: ${match[1]}`);
    }
    if (url.search || url.hash) {
      throw new Error(`Sitemap route must not contain search or hash: ${url}`);
    }
    return normalizeRoutePath(decodeURIComponent(url.pathname));
  });

  if (paths.length === 0) {
    throw new Error(`Sitemap inventory is empty: ${path}`);
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error(`Sitemap inventory contains duplicate routes: ${path}`);
  }

  return paths
    .sort((left, right) => left.localeCompare(right))
    .map((routePath) => ({
      id: accessibilityRouteId(routePath),
      path: routePath,
      capabilities: {
        explorerV2: routeHasExplorerV2(path, routePath),
      },
    }));
}

/**
 * Build the browser-test inventory from public sitemap routes plus any
 * contract-required routes that are intentionally noindex (for example, the
 * deterministic Explorer component harness). A public SEO sitemap is not a
 * complete build-route manifest, so required noindex routes must be bound by
 * the signed contract instead of being forced into the sitemap.
 */
export function parseAccessibilityRoutes(
  contract: AccessibilityContract
): InventoryRoute[] {
  const sitemapPath = contract.routes.inventory.source;
  const routesByPath = new Map(
    parseSitemapRoutes(sitemapPath).map((route) => [route.path, route])
  );

  for (const requiredRoute of contract.routes.required) {
    const routePath = normalizeRoutePath(requiredRoute.path);
    if (!routesByPath.has(routePath)) {
      routesByPath.set(routePath, {
        id: accessibilityRouteId(routePath),
        path: routePath,
        capabilities: {
          // Contract-only routes are intentionally absent from the production
          // build inventory. Browser tests still visit them through the
          // test-only server, but they must not require a forbidden production
          // artifact merely to construct the route matrix.
          explorerV2: false,
        },
      });
    }
  }

  return [...routesByPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
}

function routeHasExplorerV2(sitemapPath: string, routePath: string): boolean {
  const buildRoot = resolve(dirname(resolve(sitemapPath)));
  const relativeHtml =
    routePath === '/'
      ? 'index.html'
      : `${routePath.replace(/^\/+|\/+$/g, '')}/index.html`;
  const htmlPath = resolve(buildRoot, relativeHtml);
  if (!htmlPath.startsWith(`${buildRoot}${sep}`) || !existsSync(htmlPath)) {
    throw new Error(`Sitemap route has no generated HTML: ${routePath}`);
  }
  const html = readFileSync(htmlPath, 'utf8');
  return (
    html.includes('data-explorer-version="2"') &&
    !html.includes('data-explorer-mode="runtime"')
  );
}

const STATUS_PRECEDENCE: Record<GateStatus, number> = {
  PASS: 0,
  BLOCKED_CAPABILITY: 1,
  UNKNOWN: 2,
  FAIL: 3,
};

export function reduceStatuses(statuses: readonly GateStatus[]): GateStatus {
  if (statuses.length === 0) return 'UNKNOWN';
  return statuses.reduce((result, status) =>
    STATUS_PRECEDENCE[status] > STATUS_PRECEDENCE[result] ? status : result
  );
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function coverageForDimension(
  ids: readonly string[],
  observations: readonly AccessibilityObservation[],
  selector: (observation: AccessibilityObservation) => readonly string[],
  unavailable: ReadonlyMap<string, string>,
  evidenceArtifactId: string
): CoverageCell[] {
  return ids.map((id) => {
    const matches = observations.filter((observation) =>
      selector(observation).includes(id)
    );
    if (matches.length === 0) {
      const unavailableReason = unavailable.get(id);
      return {
        id,
        status: unavailableReason ? 'BLOCKED_CAPABILITY' : 'UNKNOWN',
        reasons: [
          unavailableReason ?? `No machine observation covered required ${id}`,
        ],
        evidenceArtifactIds: [],
      };
    }

    const status = reduceStatuses(matches.map((match) => match.status));
    return {
      id,
      status,
      reasons:
        status === 'PASS'
          ? []
          : distinct(matches.flatMap((match) => match.reasons)),
      evidenceArtifactIds: [evidenceArtifactId],
    };
  });
}

export function buildAccessibilityCells(
  contract: AccessibilityContract,
  routes: readonly InventoryRoute[],
  observations: readonly AccessibilityObservation[],
  evidenceArtifactId: string
): AccessibilityResultCell[] {
  const environmentIds = contract.environments.map(({ id }) => id);
  const unavailableModes = new Map(
    contract.unavailableInteractionModes.map(({ id, reason }) => [id, reason])
  );

  return routes.flatMap((route) =>
    contract.cells.localRequired.map((oracle) => {
      const oracleId = oracle.id;
      const matches = observations.filter(
        (observation) =>
          observation.routePath === route.path &&
          observation.oracleId === oracleId
      );
      const coverage = {
        environments: coverageForDimension(
          environmentIds,
          matches,
          (observation) => observation.environmentIds,
          new Map(),
          evidenceArtifactId
        ),
        themes: coverageForDimension(
          contract.themes,
          matches,
          (observation) => observation.themes,
          new Map(),
          evidenceArtifactId
        ),
        interactionModes: coverageForDimension(
          contract.interactionModes,
          matches,
          (observation) => observation.interactionModes,
          unavailableModes,
          evidenceArtifactId
        ),
      };
      const coverageCells = [
        ...coverage.environments,
        ...coverage.themes,
        ...coverage.interactionModes,
      ];
      const applicable =
        oracle.requiredCoverage.routeCapability === 'all' ||
        route.capabilities.explorerV2;
      const requiredCoverageCells = [
        ...coverage.environments.filter((cell) =>
          oracle.requiredCoverage.environments.includes(cell.id)
        ),
        ...coverage.themes.filter((cell) =>
          oracle.requiredCoverage.themes.includes(cell.id)
        ),
        ...coverage.interactionModes.filter((cell) =>
          oracle.requiredCoverage.interactionModes.includes(cell.id)
        ),
      ];
      const status = applicable
        ? reduceStatuses(requiredCoverageCells.map((cell) => cell.status))
        : 'UNKNOWN';
      const coverageStatus = reduceStatuses(
        coverageCells.map((cell) => cell.status)
      );
      const missingObservationReason =
        matches.length === 0
          ? [`No result was emitted for ${oracleId} on ${route.path}`]
          : [];

      return {
        id: accessibilityCellId(route.id, oracleId),
        oracleId,
        routeId: route.id,
        routePath: route.path,
        applicable,
        required: applicable,
        status,
        coverageStatus,
        reasons:
          status === 'PASS'
            ? []
            : distinct([
                ...(applicable
                  ? missingObservationReason
                  : [
                      `${oracleId} requires Explorer V2, which is not present on ${route.path}`,
                    ]),
                ...requiredCoverageCells.flatMap((cell) => cell.reasons),
              ]),
        evidenceArtifactIds: matches.length > 0 ? [evidenceArtifactId] : [],
        coverage,
      };
    })
  );
}

export function buildAccessibilityClaimCells(
  contract: AccessibilityContract
): AccessibilityClaimCell[] {
  return contract.cells.claimBoundRequired.map((cell) => ({
    id: cell.id,
    claim: cell.claim,
    required: false,
    status: 'BLOCKED_CAPABILITY',
    reasons: [`${cell.claim} was not available in the local browser harness`],
    evidenceArtifactIds: [],
  }));
}

export function buildAccessibilityStateCells(
  contract: AccessibilityContract,
  routes: readonly InventoryRoute[],
  observations: readonly AccessibilityObservation[],
  evidenceArtifactId: string
): AccessibilityStateCell[] {
  const explorerV2Present = routes.some(
    (route) => route.capabilities.explorerV2
  );
  const stateIds = Array.isArray(contract.materiallyDistinctStates)
    ? contract.materiallyDistinctStates.filter(
        (entry): entry is string => typeof entry === 'string'
      )
    : [];
  const unavailableStates = new Map(
    contract.unavailableStates.map(({ id, reason }) => [id, reason])
  );
  return stateIds.map((id) => {
    const matches = observations.filter((observation) =>
      observation.stateIds.includes(id)
    );
    const unavailableReason = unavailableStates.get(id);
    const status = unavailableReason
      ? 'BLOCKED_CAPABILITY'
      : !explorerV2Present || matches.length === 0
        ? 'UNKNOWN'
        : reduceStatuses(matches.map((observation) => observation.status));
    return {
      id,
      required: explorerV2Present && !unavailableReason,
      status,
      reasons:
        status === 'PASS'
          ? []
          : [
              explorerV2Present
                ? (unavailableReason ??
                  `No passing Explorer V2 observation covered required state ${id}`)
                : `No Explorer V2 route exists in the bound inventory; state ${id} is not locally applicable`,
            ],
      evidenceArtifactIds: matches.length > 0 ? [evidenceArtifactId] : [],
    };
  });
}
